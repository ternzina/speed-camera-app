package com.camera21wek

import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.*
import com.facebook.react.uimanager.ViewManager

class CamAlertLocalePackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(CamAlertLocaleModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}

class CamAlertLocaleModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "CamAlertLocale"

  @ReactMethod
  fun setLanguage(tag: String, promise: Promise) {
    if (tag !in listOf("ru", "uk", "en", "pl")) {
      promise.reject("unsupportedLanguage", "Unsupported language")
      return
    }
    UiThreadUtil.runOnUiThread {
      try {
        val activity = reactApplicationContext.currentActivity
        if (activity == null || activity.isFinishing || activity.isDestroyed) {
          promise.reject("noActivity", "App window is not ready")
          return@runOnUiThread
        }
        reactApplicationContext.getSharedPreferences("camalert_locale", 0).edit().putString("language", tag).apply()
        if (AppCompatDelegate.getApplicationLocales().toLanguageTags() != tag) {
          AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(tag))
        }
        promise.resolve(tag)
      } catch (error: Exception) {
        promise.reject("localeFailed", error)
      }
    }
  }
}
