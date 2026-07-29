import pennylane as qml
from pennylane import numpy as np

# Khởi tạo Quantum Simulator với 2 Qubit
dev = qml.device("default.qubit", wires=2)

@qml.qnode(dev)
def quantum_risk_circuit(features, weights):
    """
    Mạch lượng tử nhận các đặc trưng tài chính và phân tích rủi ro.
    """
    qml.AngleEmbedding(features=features, wires=range(2), rotation='Y')
    qml.BasicEntanglerLayers(weights=weights, wires=range(2))
    return qml.expval(qml.PauliZ(0))

def analyze_document_quantum(roi_claim=0.85, urgency_score=0.90):
    """
    Hàm gọi từ Frontend để chạy mô phỏng lượng tử.
    Nhận đầu vào là các chỉ số bóc tách từ hợp đồng/tin nhắn.
    """
    np.random.seed(42)
    initial_weights = np.random.random((2, 2))
    features = np.array([roi_claim, urgency_score], requires_grad=False)
    
    # Chạy mạch lượng tử
    quantum_output = quantum_risk_circuit(features, initial_weights)
    
    # Chuẩn hóa về phần trăm 0-100%
    risk_percentage = ((quantum_output + 1) / 2) * 100
    risk_score = round(float(risk_percentage), 2)
    
    if risk_score > 75:
        return risk_score, "Nguy hiểm (Đỏ)", "Tài liệu này chứa cam kết lợi nhuận bất thường. Tuyệt đối không chuyển tiền!"
    elif risk_score > 40:
        return risk_score, "Cảnh báo (Vàng)", "Hợp đồng có nhiều điều khoản mập mờ, cần nhờ người thân kiểm tra lại."
    else:
        return risk_score, "An toàn (Xanh)", "Chưa phát hiện rủi ro rõ ràng."