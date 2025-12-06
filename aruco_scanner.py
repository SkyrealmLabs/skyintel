import sys
import json
import base64
import numpy as np
import cv2

def scan_aruco(base64_image_data):
    try:
        # 1. Decode Base64
        # Mengeluarkan awalan "data:image/png;base64,"
        if ',' in base64_image_data:
            _, base64_image_data = base64_image_data.split(',', 1)
            
        img_bytes = base64.b64decode(base64_image_data)
        
        # 2. Baca Imej menggunakan NumPy dan OpenCV
        img_np = np.frombuffer(img_bytes, dtype=np.uint8)
        img = cv2.imdecode(img_np, cv2.IMREAD_COLOR)

        if img is None:
            return {"success": False, "error": "Could not decode image."}

        # 3. Tetapkan Aruco Dictionary (Mesti sepadan dengan marker anda)
        # Kami akan menggunakan DICT_6X6_250 (sama seperti ARUCO_DICT = 4 dalam Node.js)
        # Guna fungsi cv2.aruco.getPredefinedDictionary
        aruco_dict = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_6X6_250)
        
        # Tetapkan parameter detector (optional)
        parameters = cv2.aruco.DetectorParameters()

        # 4. Deteksi Marker
        detector = cv2.aruco.ArucoDetector(aruco_dict, parameters)
        corners, ids, rejected = detector.detectMarkers(img)
        
        detected_id = None
        if ids is not None and len(ids) > 0:
            # Ambil ID marker pertama (ids adalah array 2D)
            detected_id = int(ids[0][0])
            
        return {"success": True, "arucoId": detected_id}

    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    # Baca input Base64 dari stdin (yang dihantar oleh Node.js)
    try:
        # Node.js akan menghantar JSON string yang mengandungi kunci 'image'
        input_data = sys.stdin.read()
        data = json.loads(input_data)
        base64_image = data.get('image')

        result = scan_aruco(base64_image)
        
    except Exception as e:
        result = {"success": False, "error": f"Input parsing error: {str(e)}"}
    
    # Cetak hasil (dalam format JSON) ke stdout untuk dibaca oleh Node.js
    print(json.dumps(result))