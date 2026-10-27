package com.geoorigen.campo;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin propio del control de veracidad (debe registrarse antes de super.onCreate)
        registerPlugin(VeracidadPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
