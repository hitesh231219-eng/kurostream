# KuroStream Android R8 / ProGuard Release Rules

# Preserve Capacitor Bridge, Plugins, and WebView JS Interface
-keep public class com.kurostream.app.** { *; }
-keep public class com.getcapacitor.** { *; }
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Preserve WebView & Cordova reflection hooks
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
-keepclassmembers class * extends android.webkit.WebViewClient {
    public *;
}
-keepclassmembers class * extends android.webkit.WebChromeClient {
    public *;
}
-dontwarn org.apache.cordova.**
