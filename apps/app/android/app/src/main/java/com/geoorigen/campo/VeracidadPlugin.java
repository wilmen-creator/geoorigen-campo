package com.geoorigen.campo;

import android.content.Context;
import android.location.Location;
import android.location.LocationManager;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Control de veracidad: indica si la última ubicación conocida vino de un
 * proveedor simulado (apps de "GPS falso"). La app lo llama justo después de
 * tomar el punto de captura, así que la última ubicación es la de ese momento.
 */
@CapacitorPlugin(name = "Veracidad")
public class VeracidadPlugin extends Plugin {

    @PluginMethod
    public void ubicacionSimulada(PluginCall call) {
        boolean simulada = false;
        try {
            LocationManager lm = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
            if (lm != null) {
                for (String proveedor : lm.getProviders(true)) {
                    Location l = lm.getLastKnownLocation(proveedor);
                    if (l != null && esSimulada(l)) {
                        simulada = true;
                        break;
                    }
                }
            }
        } catch (SecurityException e) {
            // Sin permiso de ubicación: no se puede saber
        }
        JSObject r = new JSObject();
        r.put("simulada", simulada);
        call.resolve(r);
    }

    @SuppressWarnings("deprecation")
    private static boolean esSimulada(Location l) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return l.isMock();
        }
        return l.isFromMockProvider();
    }
}
