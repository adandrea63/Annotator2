from flask import Flask, render_template, request, jsonify, send_from_directory
import os
from datetime import datetime
from werkzeug.utils import secure_filename
import xml.etree.ElementTree as ET
from xml.dom import minidom

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max

# Assicurati che la cartella uploads esista
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'Nessun file selezionato'}), 400
    
    files = request.files.getlist('file')
    saved_files = []
    
    for file in files:
        if file.filename == '':
            continue
            
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            saved_files.append(filename)
    
    return jsonify({'files': saved_files})

@app.route('/save_annotations', methods=['POST'])
def save_annotations():
    data = request.json
    image_name = data.get('image_name')
    annotations = data.get('annotations')
    
    if not image_name or not annotations:
        return jsonify({'error': 'Dati mancanti'}), 400
    
    # Crea elemento root per XML
    root_elem = ET.Element("annotations")
    root_elem.set("image", image_name)
    root_elem.set("timestamp", datetime.now().isoformat())
    
    # Aggiungi ogni annotazione
    for ann in annotations:
        shape_elem = ET.SubElement(root_elem, "shape")
        shape_elem.set("type", ann['type'])
        shape_elem.set("label", ann.get('label', ''))
        
        points_elem = ET.SubElement(shape_elem, "points")
        points_elem.text = ','.join(map(str, ann['points']))
        
        if 'annotation' in ann:
            ann_elem = ET.SubElement(shape_elem, "annotation")
            ann_elem.text = ann['annotation']
        
        # Aggiungi metadati Dublin Core se presenti
        dc_fields = ['title', 'creator', 'subject', 'description', 'publisher', 
                     'contributor', 'date', 'type', 'format', 'identifier', 
                     'source', 'language', 'relation', 'coverage', 'rights']
        
        for field in dc_fields:
            if field in ann:
                field_elem = ET.SubElement(shape_elem, field)
                field_elem.text = str(ann[field])
    
    # Salva il file XML
    xml_str = minidom.parseString(ET.tostring(root_elem)).toprettyxml(indent="  ")
    xml_filename = f"{os.path.splitext(image_name)[0]}_annotations.xml"
    xml_path = os.path.join(app.config['UPLOAD_FOLDER'], xml_filename)
    
    with open(xml_path, 'w', encoding='utf-8') as f:
        f.write(xml_str)
    
    return jsonify({'message': 'Annotazioni salvate con successo', 'xml_file': xml_filename})

@app.route('/load_annotations', methods=['GET'])
def load_annotations():
    image_name = request.args.get('image_name')
    if not image_name:
        return jsonify({'error': 'Nome immagine mancante'}), 400
    
    xml_filename = f"{os.path.splitext(image_name)[0]}_annotations.xml"
    xml_path = os.path.join(app.config['UPLOAD_FOLDER'], xml_filename)
    
    if not os.path.exists(xml_path):
        return jsonify({'annotations': []})
    
    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()
        annotations = []
        
        for shape_elem in root.findall('shape'):
            shape_type = shape_elem.get('type', 'rectangle')
            points_str = shape_elem.find('points').text
            
            if shape_type == 'rectangle':
                points = list(map(float, points_str.split(',')))
            else:  # polygon
                points = list(map(float, points_str.split(',')))
            
            shape = {
                'type': shape_type,
                'points': points,
                'label': shape_elem.get('label', ''),
                'annotation': shape_elem.find('annotation').text if shape_elem.find('annotation') is not None else ''
            }
            
            # Carica metadati Dublin Core se presenti
            for child in shape_elem:
                if child.tag not in ['points', 'annotation']:
                    shape[child.tag] = child.text
            
            annotations.append(shape)
        
        return jsonify({'annotations': annotations})
    
    except Exception as e:
        return jsonify({'error': f"Errore caricamento annotazioni: {str(e)}"}), 500

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in {'png', 'jpg', 'jpeg'}

if __name__ == '__main__':
    app.run(debug=True)