package com.pulsegrid.app

import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebSettings
import android.webkit.WebViewClient
import android.app.Activity

class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        val webView = WebView(this)
        setContentView(webView)
        
        val webSettings = webView.settings
        webSettings.javaScriptEnabled = true
        webSettings.domStorageEnabled = true
        webSettings.allowFileAccess = true
        webSettings.allowContentAccess = true
        webSettings.loadWithOverviewMode = true
        webSettings.useWideViewPort = true
        webSettings.builtInZoomControls = true
        webSettings.displayZoomControls = false
        
        webView.webViewClient = WebViewClient()
        
        // Load from assets
        webView.loadUrl("file:///android_asset/index.html")
    }
}