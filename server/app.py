from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from excel_cleaner import ExcelCleaner
import tempfile
import requests

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Get OpenAI API key from environment variable
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

@app.route('/process-excel', methods=['POST'])
def process_excel():
    try:
        # Get the file URL from the request
        data = request.json
        file_url = data.get('filePath')
        
        if not file_url:
            return jsonify({'error': 'No file URL provided'}), 400
            
        if not OPENAI_API_KEY:
            return jsonify({'error': 'OpenAI API key not configured'}), 500

        # Download the file to a temporary location
        response = requests.get(file_url)
        if response.status_code != 200:
            return jsonify({'error': 'Failed to download file'}), 400

        # Create a temporary file
        with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as temp_file:
            temp_file.write(response.content)
            temp_file_path = temp_file.name

        # Process the Excel file
        cleaner = ExcelCleaner(OPENAI_API_KEY)
        result = cleaner.process_excel_file(temp_file_path)

        # Clean up the temporary file
        os.unlink(temp_file_path)

        return jsonify(result)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    if not OPENAI_API_KEY:
        print("WARNING: OPENAI_API_KEY environment variable not set!")
    app.run(port=3000)