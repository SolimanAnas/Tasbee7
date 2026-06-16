from flask import Flask, send_file, send_from_directory, make_response
import os
import mimetypes

app = Flask(__name__, static_folder=None)

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = 8080

mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('image/svg+xml', '.svg')
mimetypes.add_type('font/ttf', '.ttf')
mimetypes.add_type('font/otf', '.otf')
mimetypes.add_type('image/webp', '.webp')

@app.after_request
def add_headers(resp):
    resp.headers['Service-Worker-Allowed'] = '/'
    resp.headers['Access-Control-Allow-Origin'] = '*'
    return resp

@app.route('/')
def index():
    return send_from_directory(ROOT, 'index.html')

@app.route('/Tasbee7/')
@app.route('/Tasbee7/index.html')
def tasbee7_index():
    return send_from_directory(ROOT, 'index.html')

@app.route('/Tasbee7/<path:subpath>')
def tasbee7_subpath(subpath):
    fp = os.path.join(ROOT, subpath)
    if os.path.isfile(fp):
        return send_file(fp)
    fp = os.path.join(ROOT, subpath, 'index.html')
    if os.path.isfile(fp):
        return send_file(fp)
    return send_from_directory(ROOT, subpath)

@app.route('/<path:filepath>')
def serve_file(filepath):
    fp = os.path.join(ROOT, filepath)
    if os.path.isfile(fp):
        return send_file(fp)
    return f'<h1>404 Not Found</h1><p>{filepath}</p>', 404

if __name__ == '__main__':
    print(f'Serving Tasbee7 at http://localhost:{PORT}')
    app.run(host='0.0.0.0', port=PORT, debug=False)
