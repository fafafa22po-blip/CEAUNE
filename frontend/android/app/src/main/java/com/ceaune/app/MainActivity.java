package com.ceaune.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(ExternalLinkPlugin.class);
        registerPlugin(DocumentScannerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
