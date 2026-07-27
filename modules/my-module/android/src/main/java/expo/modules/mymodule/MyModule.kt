package expo.modules.mymodule

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MyModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MyModule")

    View(MyModuleView::class) {
      Prop("color") { view: MyModuleView, colorHex: String ->
        view.setInkColor(colorHex)
      }
      
      Prop("isEraser") { view: MyModuleView, eraser: Boolean ->
        view.setIsEraser(eraser)
      }
      
      AsyncFunction("undo") { view: MyModuleView ->
        view.undo()
      }

      Prop("strokeWidth") { view: MyModuleView, width: Double ->
        view.setStrokeWidth(width.toFloat())
      }
      
      Prop("penType") { view: MyModuleView, type: String ->
        view.setPenType(type)
      }
      
      AsyncFunction("clear") { view: MyModuleView ->
        view.clear()
      }
      
      AsyncFunction("saveAsImage") { view: MyModuleView ->
        return@AsyncFunction view.saveAsImage()
      }
    }
  }
}

