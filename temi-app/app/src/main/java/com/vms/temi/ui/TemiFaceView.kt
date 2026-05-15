package com.vms.temi.ui

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.*
import android.util.AttributeSet
import android.view.View
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

enum class FaceState { IDLE, GREETING, NAVIGATING, ARRIVED }

class TemiFaceView @JvmOverloads constructor(
    context: Context, attrs: AttributeSet? = null
) : View(context, attrs) {

    var faceState: FaceState = FaceState.IDLE
        set(value) {
            if (field == value) return
            field = value
            cancelAnimators()
            when (value) {
                FaceState.IDLE       -> { targetSmile = 0.35f; startIdleAnims() }
                FaceState.GREETING   -> { targetSmile = 0.95f; startIdleAnims() }
                FaceState.NAVIGATING -> { targetSmile = 0.15f; startNavAnims() }
                FaceState.ARRIVED    -> { targetSmile = 1.00f; startArrivedAnims() }
            }
        }

    private var blinkProgress = 1f
    private var targetSmile = 0.35f
    private var currentSmile = 0.35f
    private var glowAlpha = 55f
    private var dotPhase = 0f
    private val animList = mutableListOf<ValueAnimator>()

    private val facePaint    = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.parseColor("#120000") }
    private val ringPaint    = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.parseColor("#DC2626"); style = Paint.Style.STROKE; strokeWidth = 4f }
    private val glowPaint    = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.parseColor("#DC2626"); style = Paint.Style.STROKE }
    private val eyeBgPaint   = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.parseColor("#200000") }
    private val eyeRingPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.parseColor("#DC2626"); style = Paint.Style.STROKE; strokeWidth = 1.5f; alpha = 110 }
    private val pupilPaint   = Paint(Paint.ANTI_ALIAS_FLAG)
    private val glintPaint   = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE; alpha = 210 }
    private val mouthPaint   = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE; style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND }
    private val dotPaint     = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.parseColor("#DC2626") }
    private val mouthPath    = Path()

    init { startIdleAnims() }

    private fun anim(block: ValueAnimator.() -> Unit): ValueAnimator =
        ValueAnimator().also { it.block(); it.start(); animList.add(it) }

    private fun cancelAnimators() { animList.forEach { it.cancel() }; animList.clear(); dotPhase = 0f }

    private fun startIdleAnims() {
        anim {
            setFloatValues(1f, 0.04f, 1f); duration = 180; startDelay = 3800
            repeatCount = ValueAnimator.INFINITE; repeatMode = ValueAnimator.RESTART
            addUpdateListener { blinkProgress = it.animatedValue as Float; invalidate() }
        }
        anim {
            setFloatValues(40f, 85f); duration = 1900
            repeatCount = ValueAnimator.INFINITE; repeatMode = ValueAnimator.REVERSE
            addUpdateListener { glowAlpha = it.animatedValue as Float; invalidate() }
        }
        anim {
            setFloatValues(currentSmile, targetSmile); duration = 600
            addUpdateListener { currentSmile = it.animatedValue as Float; invalidate() }
        }
    }

    private fun startNavAnims() {
        anim {
            setFloatValues(1f, 0.04f, 1f); duration = 155; startDelay = 1300
            repeatCount = ValueAnimator.INFINITE; repeatMode = ValueAnimator.RESTART
            addUpdateListener { blinkProgress = it.animatedValue as Float; invalidate() }
        }
        anim {
            setFloatValues(70f, 165f); duration = 620
            repeatCount = ValueAnimator.INFINITE; repeatMode = ValueAnimator.REVERSE
            addUpdateListener { glowAlpha = it.animatedValue as Float; invalidate() }
        }
        anim {
            setFloatValues(0f, 1f); duration = 540
            repeatCount = ValueAnimator.INFINITE; repeatMode = ValueAnimator.RESTART
            addUpdateListener { dotPhase = it.animatedValue as Float; invalidate() }
        }
        anim {
            setFloatValues(currentSmile, targetSmile); duration = 600
            addUpdateListener { currentSmile = it.animatedValue as Float; invalidate() }
        }
    }

    private fun startArrivedAnims() {
        anim {
            setFloatValues(1f, 0.04f, 1f); duration = 150; startDelay = 250
            repeatCount = 4; repeatMode = ValueAnimator.RESTART
            addUpdateListener { blinkProgress = it.animatedValue as Float; invalidate() }
        }
        anim {
            setFloatValues(85f, 210f); duration = 430
            repeatCount = ValueAnimator.INFINITE; repeatMode = ValueAnimator.REVERSE
            addUpdateListener { glowAlpha = it.animatedValue as Float; invalidate() }
        }
        anim {
            setFloatValues(currentSmile, 1f); duration = 380
            addUpdateListener { currentSmile = it.animatedValue as Float; invalidate() }
        }
    }

    override fun onDetachedFromWindow() { super.onDetachedFromWindow(); cancelAnimators() }

    override fun onDraw(canvas: Canvas) {
        val w = width.toFloat()
        val h = height.toFloat()
        val cx = w / 2f
        val cy = h / 2f
        val faceR = min(w, h) * 0.42f

        // Multi-layer glow rings
        for (i in 4 downTo 1) {
            glowPaint.alpha = (glowAlpha / (i * 1.6f)).toInt().coerceIn(0, 255)
            glowPaint.strokeWidth = i * 5f
            canvas.drawCircle(cx, cy, faceR + i * 4f, glowPaint)
        }

        // Face circle
        canvas.drawCircle(cx, cy, faceR, facePaint)
        ringPaint.alpha = 200; ringPaint.strokeWidth = 4f
        canvas.drawCircle(cx, cy, faceR, ringPaint)

        // Eyes
        val eyeY      = cy - faceR * 0.16f
        val halfSpace = faceR * 0.37f
        val eyeR      = faceR * 0.22f

        for (sign in intArrayOf(-1, 1)) {
            val ex     = cx + sign * halfSpace
            val scaleY = blinkProgress.coerceAtLeast(0.04f)
            canvas.save()
            canvas.scale(1f, scaleY, ex, eyeY)

            canvas.drawCircle(ex, eyeY, eyeR, eyeBgPaint)
            canvas.drawCircle(ex, eyeY, eyeR, eyeRingPaint)

            val pupilR = eyeR * 0.56f
            pupilPaint.shader = RadialGradient(
                ex, eyeY - pupilR * 0.15f, pupilR,
                Color.parseColor("#FF5555"), Color.parseColor("#B91C1C"),
                Shader.TileMode.CLAMP
            )
            canvas.drawCircle(ex, eyeY, pupilR, pupilPaint)
            canvas.drawCircle(ex - pupilR * 0.34f, eyeY - pupilR * 0.34f, pupilR * 0.21f, glintPaint)

            canvas.restore()
        }

        // Mouth
        val mouthCy    = cy + faceR * 0.34f
        val mouthHalfW = faceR * 0.44f
        val smileDip   = currentSmile * faceR * 0.22f
        mouthPaint.strokeWidth = faceR * 0.068f
        mouthPath.reset()
        mouthPath.moveTo(cx - mouthHalfW, mouthCy)
        mouthPath.quadTo(cx, mouthCy + smileDip, cx + mouthHalfW, mouthCy)
        canvas.drawPath(mouthPath, mouthPaint)

        // Navigation dots (bouncing)
        if (faceState == FaceState.NAVIGATING) {
            val dotY    = cy + faceR * 0.74f
            val spacing = faceR * 0.27f
            for (i in 0..2) {
                val p = ((dotPhase - i * 0.33f + 1f) % 1f)
                val t = if (p < 0.5f) p * 2f else (1f - p) * 2f
                dotPaint.alpha = (75 + 180 * t).toInt()
                canvas.drawCircle(cx + (i - 1) * spacing, dotY, faceR * 0.068f * (0.45f + t * 0.85f), dotPaint)
            }
        }

        // Arrived star rays
        if (faceState == FaceState.ARRIVED) {
            val rayPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = Color.parseColor("#DC2626"); style = Paint.Style.STROKE
                strokeWidth = 2.5f; alpha = 75
            }
            for (i in 0 until 8) {
                val angle = (i * 45.0 * Math.PI / 180.0).toFloat()
                val r1 = faceR + 14f; val r2 = faceR + 32f
                canvas.drawLine(
                    cx + cos(angle) * r1, cy + sin(angle) * r1,
                    cx + cos(angle) * r2, cy + sin(angle) * r2,
                    rayPaint
                )
            }
        }
    }
}
