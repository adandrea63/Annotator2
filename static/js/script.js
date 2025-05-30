document.addEventListener('DOMContentLoaded', function() {
    // Variabili globali
    let currentImage = null;
    let currentShapes = [];
    let currentAnnotations = [];
    let drawing = false;
    let currentShape = [];
    let currentShapeType = 'rectangle';
    let shapeCounter = 1;
    let polygonMode = false;
    let startX = 0;
    let startY = 0;
    let selectedShapeIndex = -1;
    
    // Elementi DOM
    const canvas = document.getElementById('annotation-canvas');
    const ctx = canvas.getContext('2d');
    const fileInput = document.getElementById('file-input');
    const uploadBtn = document.getElementById('upload-btn');
    const loadFolderBtn = document.getElementById('load-folder-btn');
    const thumbnailsContainer = document.getElementById('thumbnails-container');
    const currentFileSpan = document.getElementById('current-file');
    const annotationsBody = document.getElementById('annotations-body');
    const annotationText = document.getElementById('annotation-text');
    const creatorName = document.getElementById('creator-name');
    const addAnnotationBtn = document.getElementById('add-annotation-btn');
    const convertDcBtn = document.getElementById('convert-dc-btn');
    const deleteLastBtn = document.getElementById('delete-last-btn');
    const clearAllBtn = document.getElementById('clear-all-btn');
    const saveBtn = document.getElementById('save-btn');
    const toolRadios = document.querySelectorAll('input[name="tool"]');
    const dcModal = document.getElementById('dc-modal');
    const dcContent = document.getElementById('dc-content');
    const closeModal = document.querySelector('.close');
    const copyDcBtn = document.getElementById('copy-dc-btn');
    const exportJsonBtn = document.getElementById('export-json-btn');
    
    // Inizializza canvas
    function initCanvas() {
        canvas.width = 800;
        canvas.height = 600;
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
    }
    
    // Event listeners
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileUpload);
    loadFolderBtn.addEventListener('click', () => alert('In un\'applicazione web reale, dovresti usare un input directory'));
    addAnnotationBtn.addEventListener('click', addAnnotation);
    convertDcBtn.addEventListener('click', convertToDublinCore);
    deleteLastBtn.addEventListener('click', deleteLastShape);
    clearAllBtn.addEventListener('click', clearAllShapes);
    saveBtn.addEventListener('click', saveAnnotations);
    closeModal.addEventListener('click', () => dcModal.style.display = 'none');
    copyDcBtn.addEventListener('click', copyDcData);
    exportJsonBtn.addEventListener('click', exportDcJson);
    
    toolRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            currentShapeType = e.target.value;
            if (currentShapeType === 'rectangle') {
                polygonMode = false;
                currentShape = [];
            }
        });
    });
    
    // Canvas event listeners
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('dblclick', handleDoubleClick);
    
    // Inizializza l'applicazione
    initCanvas();
    
    // Funzioni per gestire il caricamento delle immagini
    async function handleFileUpload(e) {
        const files = e.target.files;
        if (files.length === 0) return;
        
        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
            formData.append('file', files[i]);
        }
        
        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            if (response.ok) {
                displayThumbnails(data.files);
            } else {
                alert(`Errore: ${data.error}`);
            }
        } catch (error) {
            alert(`Errore durante il caricamento: ${error.message}`);
        }
    }
    
    // Mostra le anteprime delle immagini
    function displayThumbnails(filenames) {
        thumbnailsContainer.innerHTML = '';
        
        filenames.forEach(filename => {
            const imgContainer = document.createElement('div');
            imgContainer.className = 'thumbnail';
            
            const img = document.createElement('img');
            img.src = `/uploads/${filename}`;
            img.alt = filename;
            img.addEventListener('click', () => loadImage(filename));
            
            const imgName = document.createElement('div');
            imgName.textContent = filename;
            
            imgContainer.appendChild(img);
            imgContainer.appendChild(imgName);
            thumbnailsContainer.appendChild(imgContainer);
        });
    }
    
    // Carica un'immagine nel canvas principale
    async function loadImage(filename) {
        currentImage = filename;
        currentFileSpan.textContent = `File: ${filename}`;
        currentShapes = [];
        shapeCounter = 1;
        selectedShapeIndex = -1;
        
        // Carica l'immagine
        const img = new Image();
        img.src = `/uploads/${filename}`;
        
        img.onload = function() {
            // Ridimensiona il canvas per adattarsi all'immagine mantenendo le proporzioni
            const maxWidth = 800;
            const maxHeight = 600;
            let width = img.width;
            let height = img.height;
            
            if (width > height) {
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width *= maxHeight / height;
                    height = maxHeight;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // Disegna l'immagine
            ctx.drawImage(img, 0, 0, width, height);
            
            // Carica le annotazioni esistenti
            loadExistingAnnotations(filename);
        };
    }
    
    // Carica le annotazioni esistenti
    async function loadExistingAnnotations(filename) {
        try {
            const response = await fetch(`/load_annotations?image_name=${filename}`);
            const data = await response.json();
            
            if (response.ok) {
                currentShapes = data.annotations || [];
                shapeCounter = currentShapes.length + 1;
                updateAnnotationsList();
                redrawShapes();
            } else {
                console.error(`Errore: ${data.error}`);
            }
        } catch (error) {
            console.error(`Errore durante il caricamento delle annotazioni: ${error.message}`);
        }
    }
    
    // Gestione eventi del mouse sul canvas
    function handleMouseDown(e) {
        if (!currentImage) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (currentShapeType === 'rectangle') {
            drawing = true;
            startX = x;
            startY = y;
        } else if (currentShapeType === 'polygon') {
            if (!polygonMode) {
                currentShape = [x, y];
                polygonMode = true;
            } else {
                currentShape.push(x, y);
            }
            
            // Disegna un punto temporaneo
            ctx.fillStyle = 'blue';
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    function handleMouseMove(e) {
        if (!drawing || currentShapeType !== 'rectangle') return;
        
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Ridisegna l'immagine e le forme esistenti
        redrawImageAndShapes();
        
        // Disegna il rettangolo temporaneo
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 2;
        ctx.strokeRect(startX, startY, x - startX, y - startY);
    }
    
    function handleMouseUp(e) {
        if (!drawing || currentShapeType !== 'rectangle') return;
        
        const rect = canvas.getBoundingClientRect();
        const endX = e.clientX - rect.left;
        const endY = e.clientY - rect.top;
        
        if (Math.abs(endX - startX) > 5 && Math.abs(endY - startY) > 5) {
            const shape = {
                type: 'rectangle',
                points: [startX, startY, endX, endY],
                label: `Rettangolo ${shapeCounter}`,
                annotation: ''
            };
            
            currentShapes.push(shape);
            shapeCounter++;
            
            updateAnnotationsList();
            redrawShapes();
        }
        
        drawing = false;
    }
    
    function handleDoubleClick(e) {
        if (currentShapeType === 'polygon' && polygonMode && currentShape.length >= 6) {
            const shape = {
                type: 'polygon',
                points: currentShape,
                label: `Poligono ${shapeCounter}`,
                annotation: ''
            };
            
            currentShapes.push(shape);
            shapeCounter++;
            
            polygonMode = false;
            currentShape = [];
            
            updateAnnotationsList();
            redrawShapes();
        }
    }
    
    // Ridisegna l'immagine e le forme
    function redrawImageAndShapes() {
        const img = new Image();
        img.src = `/uploads/${currentImage}`;
        
        img.onload = function() {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            redrawShapes();
        };
    }
    
    function redrawShapes() {
        if (!currentImage) return;
        
        // Ricarica l'immagine
        const img = new Image();
        img.src = `/uploads/${currentImage}`;
        
        img.onload = function() {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            // Disegna tutte le forme
            currentShapes.forEach((shape, index) => {
                if (shape.type === 'rectangle') {
                    const [x1, y1, x2, y2] = shape.points;
                    
                    if (index === selectedShapeIndex) {
                        ctx.strokeStyle = 'yellow';
                        ctx.lineWidth = 3;
                    } else {
                        ctx.strokeStyle = 'red';
                        ctx.lineWidth = 2;
                    }
                    
                    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
                    
                    // Disegna l'etichetta
                    if (shape.label) {
                        ctx.fillStyle = 'red';
                        ctx.font = 'bold 12px Arial';
                        ctx.fillText(shape.label, x1, y1 - 5);
                    }
                } else if (shape.type === 'polygon') {
                    if (index === selectedShapeIndex) {
                        ctx.strokeStyle = 'yellow';
                        ctx.lineWidth = 3;
                    } else {
                        ctx.strokeStyle = 'red';
                        ctx.lineWidth = 2;
                    }
                    
                    ctx.beginPath();
                    ctx.moveTo(shape.points[0], shape.points[1]);
                    
                    for (let i = 2; i < shape.points.length; i += 2) {
                        ctx.lineTo(shape.points[i], shape.points[i+1]);
                    }
                    
                    ctx.closePath();
                    ctx.stroke();
                    
                    // Disegna l'etichetta al centro
                    if (shape.label) {
                        const center = getPolygonCenter(shape.points);
                        ctx.fillStyle = 'red';
                        ctx.font = 'bold 12px Arial';
                        ctx.fillText(shape.label, center.x, center.y);
                    }
                }
            });
        };
    }
    
    // Calcola il centro di un poligono
    function getPolygonCenter(points) {
        let sumX = 0;
        let sumY = 0;
        let count = 0;
        
        for (let i = 0; i < points.length; i += 2) {
            sumX += points[i];
            sumY += points[i+1];
            count++;
        }
        
        return {
            x: sumX / count,
            y: sumY / count
        };
    }
    
    // Aggiorna la lista delle annotazioni
    function updateAnnotationsList() {
        annotationsBody.innerHTML = '';
        
        currentShapes.forEach((shape, index) => {
            const row = document.createElement('tr');
            row.dataset.index = index;
            
            row.addEventListener('click', () => {
                selectedShapeIndex = index;
                annotationText.value = shape.annotation || '';
                redrawShapes();
            });
            
            const idCell = document.createElement('td');
            idCell.textContent = index + 1;
            
            const typeCell = document.createElement('td');
            typeCell.textContent = shape.type === 'rectangle' ? 'Rettangolo' : 'Poligono';
            
            const labelCell = document.createElement('td');
            labelCell.textContent = shape.label || '';
            
            row.appendChild(idCell);
            row.appendChild(typeCell);
            row.appendChild(labelCell);
            annotationsBody.appendChild(row);
        });
    }
    
    // Aggiungi un'annotazione alla forma selezionata
    function addAnnotation() {
        if (selectedShapeIndex === -1) {
            alert('Seleziona una forma dalla lista');
            return;
        }
        
        const annotation = annotationText.value.trim();
        
        if (!annotation) {
            alert('Inserisci un\'annotazione');
            return;
        }
        
        if (annotation.length > 500) {
            alert('L\'annotazione supera i 500 caratteri');
            return;
        }
        
        currentShapes[selectedShapeIndex].annotation = annotation;
        currentShapes[selectedShapeIndex].label = 
            annotation.length > 30 ? annotation.substring(0, 30) + '...' : annotation;
        
        updateAnnotationsList();
        redrawShapes();
        alert('Annotazione aggiunta con successo');
    }
    
    // Converti in Dublin Core
    function convertToDublinCore() {
        if (selectedShapeIndex === -1) {
            alert('Seleziona una forma dalla lista');
            return;
        }
        
        const shape = currentShapes[selectedShapeIndex];
        
        if (!shape.annotation) {
            alert('Nessuna annotazione da convertire');
            return;
        }
        
        const creator = creatorName.value.trim() || 'Annotatore';
        const currentDate = new Date().toISOString();
        
        // Estrai parole chiave
        const words = shape.annotation.split(' ');
        const keywords = words
            .map(word => word.replace(/[.,!?]/g, '').toLowerCase())
            .filter(word => word.length > 3)
            .slice(0, 5);
        
        const subject = keywords.join(', ');
        const title = shape.annotation.length > 50 ? 
            shape.annotation.substring(0, 50) + '...' : shape.annotation;
        
        // Metadati Dublin Core
        const dcData = {
            title: title,
            creator: creator,
            subject: subject,
            description: shape.annotation,
            publisher: 'Image Annotator Web',
            contributor: creator,
            date: currentDate,
            type: 'Annotation',
            format: 'text/xml',
            identifier: `annotation_${selectedShapeIndex}_${currentDate}`,
            source: currentImage || 'unknown',
            language: 'it',
            relation: 'isPartOf image annotation project',
            coverage: 'Visual annotation',
            rights: 'Copyright reserved'
        };
        
        // Aggiorna la forma con i metadati
        currentShapes[selectedShapeIndex] = {
            ...currentShapes[selectedShapeIndex],
            ...dcData
        };
        
        // Mostra i metadati in una finestra modale
        showDublinCoreModal(dcData);
    }
    
    // Mostra i metadati Dublin Core in una finestra modale
    function showDublinCoreModal(dcData) {
        dcContent.innerHTML = '';
        
        const dcFields = [
            ['title', 'Titolo'],
            ['creator', 'Creatore'],
            ['subject', 'Soggetto'],
            ['description', 'Descrizione'],
            ['publisher', 'Editore'],
            ['contributor', 'Contributore'],
            ['date', 'Data'],
            ['type', 'Tipo'],
            ['format', 'Formato'],
            ['identifier', 'Identificatore'],
            ['source', 'Sorgente'],
            ['language', 'Lingua'],
            ['relation', 'Relazione'],
            ['coverage', 'Copertura'],
            ['rights', 'Diritti']
        ];
        
        const table = document.createElement('table');
        table.className = 'dc-table';
        
        dcFields.forEach(([key, label]) => {
            const row = document.createElement('tr');
            
            const labelCell = document.createElement('td');
            labelCell.textContent = label;
            labelCell.className = 'dc-label';
            
            const valueCell = document.createElement('td');
            valueCell.textContent = dcData[key] || 'Non disponibile';
            valueCell.className = 'dc-value';
            
            row.appendChild(labelCell);
            row.appendChild(valueCell);
            table.appendChild(row);
        });
        
        dcContent.appendChild(table);
        dcModal.style.display = 'block';
    }
    
    // Copia i dati Dublin Core negli appunti
    function copyDcData() {
        const dcText = Array.from(dcContent.querySelectorAll('tr'))
            .map(row => {
                const label = row.querySelector('.dc-label').textContent;
                const value = row.querySelector('.dc-value').textContent;
                return `${label}: ${value}`;
            })
            .join('\n');
        
        navigator.clipboard.writeText(dcText)
            .then(() => alert('Dati Dublin Core copiati negli appunti'))
            .catch(err => console.error('Errore durante la copia:', err));
    }
    
    // Esporta i metadati Dublin Core in JSON
    function exportDcJson() {
        const dcData = {};
        
        Array.from(dcContent.querySelectorAll('tr')).forEach(row => {
            const key = row.querySelector('.dc-label').textContent.toLowerCase();
            const value = row.querySelector('.dc-value').textContent;
            dcData[key] = value;
        });
        
        const jsonStr = JSON.stringify(dcData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `dublin_core_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    // Elimina l'ultima forma
    function deleteLastShape() {
        if (currentShapes.length > 0) {
            currentShapes.pop();
            updateAnnotationsList();
            redrawShapes();
        }
    }
    
    // Cancella tutte le forme
    function clearAllShapes() {
        currentShapes = [];
        updateAnnotationsList();
        redrawShapes();
    }
    
    // Salva le annotazioni sul server
    async function saveAnnotations() {
        if (!currentImage || currentShapes.length === 0) {
            alert('Nessuna annotazione da salvare');
            return;
        }
        
        try {
            const response = await fetch('/save_annotations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    image_name: currentImage,
                    annotations: currentShapes
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                alert(`Annotazioni salvate con successo: ${data.message}`);
            } else {
                alert(`Errore durante il salvataggio: ${data.error}`);
            }
        } catch (error) {
            alert(`Errore durante il salvataggio: ${error.message}`);
        }
    }
});