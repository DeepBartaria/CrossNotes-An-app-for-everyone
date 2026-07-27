package expo.modules.mymodule

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.view.MotionEvent
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

data class Stroke(val path: Path, val paint: Paint)

class MyModuleView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
    private var currentColor = Color.BLACK
    private var isEraser = false
    private val strokes = mutableListOf<Stroke>()
    private var currentPath = Path()
    private var currentPaint: Paint? = null
    private var currentPenType = "pen"
    
    private var currentStrokeWidth = 5f
    
    // For curve smoothing
    private var previousX = 0f
    private var previousY = 0f

    init {
        setWillNotDraw(false)
    }

    fun setInkColor(hex: String) {
        try {
            currentColor = Color.parseColor(hex)
        } catch (e: Exception) {
            currentColor = Color.BLACK
        }
    }
    
    fun setStrokeWidth(width: Float) {
        currentStrokeWidth = width
    }
    
    fun setPenType(type: String) {
        currentPenType = type
    }
    
    fun setIsEraser(eraser: Boolean) {
        isEraser = eraser
    }
    
    fun undo() {
        if (strokes.isNotEmpty()) {
            strokes.removeAt(strokes.size - 1)
            invalidate()
        }
    }
    
    fun clear() {
        strokes.clear()
        currentPath = Path()
        currentPaint = null
        invalidate()
    }
    
    fun saveAsImage(): String? {
        try {
            val bitmap = android.graphics.Bitmap.createBitmap(width, height, android.graphics.Bitmap.Config.ARGB_8888)
            val tempCanvas = Canvas(bitmap)
            tempCanvas.drawColor(Color.WHITE)
            for (stroke in strokes) {
                tempCanvas.drawPath(stroke.path, stroke.paint)
            }
            val outputStream = java.io.ByteArrayOutputStream()
            bitmap.compress(android.graphics.Bitmap.CompressFormat.JPEG, 80, outputStream)
            val byteArray = outputStream.toByteArray()
            return android.util.Base64.encodeToString(byteArray, android.util.Base64.DEFAULT)
        } catch (e: Exception) {
            return null
        }
    }

    private fun createPaint(): Paint {
        return Paint().apply {
            if (isEraser || isTemporaryEraser) {
                color = Color.TRANSPARENT
                strokeWidth = currentStrokeWidth * 5f // Thicker for eraser
                xfermode = android.graphics.PorterDuffXfermode(android.graphics.PorterDuff.Mode.CLEAR)
                isAntiAlias = true
                style = Paint.Style.STROKE
                strokeJoin = Paint.Join.ROUND
                strokeCap = Paint.Cap.ROUND
            } else {
                color = currentColor
                strokeWidth = currentStrokeWidth
                xfermode = null
                isAntiAlias = true
                style = Paint.Style.STROKE

                when (currentPenType) {
                    "pencil" -> {
                        pathEffect = android.graphics.DiscretePathEffect(10f, 2f)
                        alpha = 150
                        strokeJoin = Paint.Join.ROUND
                        strokeCap = Paint.Cap.ROUND
                    }
                    "brush" -> {
                        maskFilter = android.graphics.BlurMaskFilter(currentStrokeWidth / 2f, android.graphics.BlurMaskFilter.Blur.NORMAL)
                        alpha = 180
                        strokeJoin = Paint.Join.ROUND
                        strokeCap = Paint.Cap.ROUND
                    }
                    "fountain" -> {
                        // Simulating calligraphy with a flat/chisel tip using SQUARE cap and BEVEL join
                        strokeJoin = Paint.Join.BEVEL
                        strokeCap = Paint.Cap.SQUARE
                    }
                    else -> {
                        // Standard pen
                        strokeJoin = Paint.Join.ROUND
                        strokeCap = Paint.Cap.ROUND
                    }
                }
            }
        }
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        // Use saveLayer to allow PorterDuff.Mode.CLEAR to erase only the drawing layer, 
        // not punch a hole through the entire view background!
        val saveCount = canvas.saveLayer(0f, 0f, width.toFloat(), height.toFloat(), null)
        
        for (stroke in strokes) {
            canvas.drawPath(stroke.path, stroke.paint)
        }
        currentPaint?.let {
            canvas.drawPath(currentPath, it)
        }
        
        canvas.restoreToCount(saveCount)
    }

    private var isTemporaryEraser = false

    override fun onTouchEvent(event: MotionEvent): Boolean {
        val x = event.x
        val y = event.y

        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                val isStylusButtonDown = (event.buttonState and MotionEvent.BUTTON_STYLUS_PRIMARY) != 0
                val isEraserTool = event.getToolType(0) == MotionEvent.TOOL_TYPE_ERASER
                isTemporaryEraser = isStylusButtonDown || isEraserTool
                
                parent?.requestDisallowInterceptTouchEvent(true)
                currentPath = Path()
                currentPaint = createPaint()
                currentPath.moveTo(x, y)
                previousX = x
                previousY = y
                invalidate()
                return true
            }
            MotionEvent.ACTION_MOVE -> {
                // Calculate midpoint
                val midX = (previousX + x) / 2
                val midY = (previousY + y) / 2
                
                // Draw bezier curve to midpoint for smooth lines
                currentPath.quadTo(previousX, previousY, midX, midY)
                
                previousX = x
                previousY = y
                invalidate()
                return true
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                currentPath.lineTo(x, y)
                currentPaint?.let {
                    strokes.add(Stroke(currentPath, it))
                }
                currentPath = Path()
                currentPaint = null
                invalidate()
                return true
            }
            else -> return false
        }
    }
}

