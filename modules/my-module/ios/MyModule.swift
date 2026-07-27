import ExpoModulesCore

public class MyModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MyModule")

    View(MyModuleView.self) {
      Prop("color") { (view: MyModuleView, colorHex: String) in
        view.setInkColor(hex: colorHex)
      }
      
      Prop("isEraser") { (view: MyModuleView, eraser: Bool) in
        view.setIsEraser(eraser: eraser)
      }
      
      AsyncFunction("undo") { (view: MyModuleView) in
        view.undo()
      }
      
      Prop("strokeWidth") { (view: MyModuleView, width: Double) in
        view.setStrokeWidth(width: width)
      }
      
      Prop("penType") { (view: MyModuleView, type: String) in
        view.setPenType(type: type)
      }
      
      AsyncFunction("clear") { (view: MyModuleView) in
        view.clear()
      }
      
      AsyncFunction("saveAsImage") { (view: MyModuleView) -> String? in
        return view.saveAsImage()
      }
    }
  }
}
