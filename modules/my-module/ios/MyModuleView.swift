import ExpoModulesCore
import PencilKit
import UIKit

class MyModuleView: ExpoView {
  let canvasView = PKCanvasView(frame: .zero)

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    
    // Set up PencilKit Canvas
    canvasView.backgroundColor = .clear
    canvasView.isOpaque = false
    canvasView.drawingPolicy = .anyInput // Allows both finger and Apple Pencil
    
    if #available(iOS 14.0, *) {
      canvasView.tool = PKInkingTool(.pen, color: .black, width: 2)
    }

    addSubview(canvasView)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    canvasView.frame = bounds
  }

  var currentColorHex: String = "#000000"
  var currentStrokeWidth: CGFloat = 5.0
  var currentPenType: String = "pen"

  func setInkColor(hex: String) {
    currentColorHex = hex
    updateTool()
  }
  
  func setStrokeWidth(width: Double) {
    currentStrokeWidth = CGFloat(width)
    updateTool()
  }

  func setPenType(type: String) {
    currentPenType = type
    updateTool()
  }

  func updateTool() {
    if #available(iOS 14.0, *) {
      let color = hexStringToUIColor(hex: currentColorHex)
      switch currentPenType {
      case "pencil":
        canvasView.tool = PKInkingTool(.pencil, color: color, width: currentStrokeWidth)
      case "fountain":
        if #available(iOS 17.0, *) {
          canvasView.tool = PKInkingTool(.fountainPen, color: color, width: currentStrokeWidth)
        } else {
          canvasView.tool = PKInkingTool(.pen, color: color, width: currentStrokeWidth * 1.5)
        }
      case "brush":
        if #available(iOS 17.0, *) {
          canvasView.tool = PKInkingTool(.watercolor, color: color, width: currentStrokeWidth)
        } else {
          canvasView.tool = PKInkingTool(.marker, color: color, width: currentStrokeWidth)
        }
      default:
        canvasView.tool = PKInkingTool(.pen, color: color, width: currentStrokeWidth)
      }
    }
  }

  func setIsEraser(eraser: Bool) {
    if eraser {
      canvasView.tool = PKEraserTool(.vector)
    } else {
      updateTool()
    }
  }

  func undo() {
    canvasView.undoManager?.undo()
  }
  
  func clear() {
    canvasView.drawing = PKDrawing()
  }
  
  func saveAsImage() -> String? {
    let image = canvasView.drawing.image(from: canvasView.bounds, scale: 1.0)
    return image.jpegData(compressionQuality: 0.8)?.base64EncodedString()
  }

  func hexStringToUIColor(hex: String) -> UIColor {
    var cString:String = hex.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()

    if (cString.hasPrefix("#")) {
        cString.remove(at: cString.startIndex)
    }

    if ((cString.count) != 6) {
        return UIColor.black
    }

    var rgbValue:UInt64 = 0
    Scanner(string: cString).scanHexInt64(&rgbValue)

    return UIColor(
        red: CGFloat((rgbValue & 0xFF0000) >> 16) / 255.0,
        green: CGFloat((rgbValue & 0x00FF00) >> 8) / 255.0,
        blue: CGFloat(rgbValue & 0x0000FF) / 255.0,
        alpha: CGFloat(1.0)
    )
  }
}

