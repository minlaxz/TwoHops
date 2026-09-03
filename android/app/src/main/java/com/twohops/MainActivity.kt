package com.twohops

import android.os.Bundle
import android.view.ViewGroup
import android.view.ViewTreeObserver
import com.swmansion.rnscreens.fragment.restoration.RNScreensFragmentFactory
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "TwoHops"

  override fun onCreate(savedInstanceState: Bundle?) {
    supportFragmentManager.fragmentFactory = RNScreensFragmentFactory()
    super.onCreate(savedInstanceState)
    // SplashTheme (manifest) keeps the splash artwork as the window background
    // until the React root view has laid out real content, so cold start stays
    // seamless. Then swap to a plain colour so screen transitions never bleed
    // the splash through a window-level gap.
    val content = findViewById<ViewGroup>(android.R.id.content)
    content.viewTreeObserver.addOnGlobalLayoutListener(
        object : ViewTreeObserver.OnGlobalLayoutListener {
          override fun onGlobalLayout() {
            val root = content.getChildAt(0) as? ViewGroup ?: return
            if (root.childCount == 0) return
            window.setBackgroundDrawableResource(R.color.twohops_splash_background)
            content.viewTreeObserver.removeOnGlobalLayoutListener(this)
          }
        })
  }

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
