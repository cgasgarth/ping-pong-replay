import Foundation
import Vision
import simd

struct Joint: Codable {
    let x: Float
    let y: Float
    let z: Float
    let u: Double
    let v: Double
    let confidence: Float
}
struct Response: Codable {
    let joints: [Joint]
    let error: String?
}
let names: [VNHumanBodyPose3DObservation.JointName] = [
    .centerHead, .centerHead, .centerHead, .centerHead, .centerHead,
    .leftShoulder, .rightShoulder, .leftElbow, .rightElbow, .leftWrist,
    .rightWrist, .leftHip, .rightHip, .leftKnee, .rightKnee, .leftAnkle, .rightAnkle
]
while let line = readLine() {
    autoreleasepool {
        let response: Response
        do {
            guard let data = Data(base64Encoded: line) else {
                throw CocoaError(.fileReadCorruptFile)
            }
            let request = VNDetectHumanBodyPose3DRequest()
            try VNImageRequestHandler(data: data).perform([request])
            var joints: [Joint] = []
            if let observation = request.results?.first {
                for name in names {
                    let point = try observation.recognizedPoint(name)
                    let image = try observation.pointInImage(name)
                    let position = (observation.cameraOriginMatrix * point.position).columns.3
                    joints.append(Joint(x: position.x, y: -position.y, z: -position.z,
                        u: image.x, v: 1 - image.y, confidence: observation.confidence))
                }
            }
            response = Response(joints: joints, error: nil)
        } catch {
            response = Response(joints: [], error: error.localizedDescription)
        }
        do {
            let encoded = try JSONEncoder().encode(response)
            FileHandle.standardOutput.write(encoded)
            FileHandle.standardOutput.write(Data([10]))
        } catch {
            FileHandle.standardError.write(Data("Cannot encode pose response\n".utf8))
        }
    }
}
