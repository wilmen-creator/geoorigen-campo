// GPS de la app: ubicación para los campos GPS y evidencia silenciosa de captura.
// La evidencia nunca se le muestra al técnico ni bloquea nada: solo se guarda.

import { Capacitor, registerPlugin } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { Device } from '@capacitor/device';
import type { PuntoGPS } from './db.ts';

// Plugin nativo propio (android/.../VeracidadPlugin.java): dice si la última
// ubicación vino de una app de "GPS falso".
interface PluginVeracidad {
  ubicacionSimulada(): Promise<{ simulada: boolean }>;
}
const Veracidad = registerPlugin<PluginVeracidad>('Veracidad', {
  web: { ubicacionSimulada: async () => ({ simulada: false }) },
});

/** Pide una ubicación precisa. Devuelve null si no hay permiso o no se pudo en el tiempo dado. */
export async function tomarPunto(timeout = 20000): Promise<PuntoGPS | null> {
  try {
    const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout, maximumAge: 0 });
    return {
      lat: p.coords.latitude,
      lon: p.coords.longitude,
      precision: Math.round(p.coords.accuracy * 10) / 10,
      // p.timestamp es la hora del GPS, no la del reloj del celular
      en: new Date(p.timestamp).toISOString(),
    };
  } catch {
    return null;
  }
}

export async function ubicacionSimulada(): Promise<boolean> {
  try {
    return (await Veracidad.ubicacionSimulada()).simulada;
  } catch {
    return false;
  }
}

/** Evidencia de captura: punto + ¿simulado? Se llama al abrir y al enviar una encuesta. */
export async function tomarEvidencia(): Promise<{ punto: PuntoGPS | null; simulada: boolean }> {
  const punto = await tomarPunto();
  const simulada = punto ? await ubicacionSimulada() : false;
  return { punto, simulada };
}

let infoDispositivo: Record<string, string> | null = null;
export async function datosDispositivo(): Promise<Record<string, string>> {
  if (infoDispositivo) return infoDispositivo;
  try {
    const d = await Device.getInfo();
    infoDispositivo = {
      modelo: `${d.manufacturer} ${d.model}`.trim(),
      sistema: `${d.operatingSystem} ${d.osVersion}`,
      plataforma: Capacitor.getPlatform(),
      app: __VERSION_APP__,
    };
  } catch {
    infoDispositivo = { modelo: navigator.userAgent.slice(0, 80), plataforma: Capacitor.getPlatform(), app: __VERSION_APP__ };
  }
  return infoDispositivo;
}
