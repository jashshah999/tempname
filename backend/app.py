from flask import Flask
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # This allows our React frontend to make requests to our Flask backend

@app.route('/api/test', methods=['GET'])
def test_route():
    return {"message": "🚀 Flask Backend is Connected!"}

if __name__ == '__main__':
    app.run(debug=True, port=5000) 