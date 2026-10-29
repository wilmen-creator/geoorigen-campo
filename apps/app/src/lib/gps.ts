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

const aPunto = (p: { coords: { latitude: number; longitude: number; accuracy: number }; timestamp: number }): PuntoGPS => ({
  lat: p.coords.latitude,
  lon: p.coords.longitude,
  precision: Math.round(p.coords.accuracy * 10) / 10,
  // p.timestamp es la hora del GPS, no la del reloj del celular
  en: new Date(p.timestamp).toISOString(),
});

/** Pide el permiso de ubicación al entrar, no a mitad de una encuesta */
export async function pedirPermisoUbicacion() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const p = await Geolocation.checkPermissions();
    if (p.location !== 'granted') await Geolocation.requestPermissions({ permissions: ['location'] });
  } catch { /* el GPS del celular está apagado: se reintenta al capturar */ }
}

// Último punto visto mientras una encuesta está abierta: así enviar o tomar una
// foto no espera al GPS (sin señal puede tardar 20 s o más).
let ultimo: PuntoGPS | null = null;
let vigilancia: string | null = null;

/** Mantiene el GPS encendido mientras la encuesta está abierta. Devuelve la función para apagarlo. */
export function vigilarGPS(): () => void {
  let apagado = false;
  Geolocation.watchPosition({ enableHighAccuracy: true, maximumAge: 0 }, (p) => {
    if (p) ultimo = aPunto(p);
  }).then((id) => {
    if (apagado) Geolocation.clearWatch({ id });
    else vigilancia = id;
  }).catch(() => { /* sin permiso: se usa tomarPunto */ });
  return () => {
    apagado = true;
    if (vigilancia) Geolocation.clearWatch({ id: vigilancia });
    vigilancia = null;
  };
}

/** Pide una ubicación precisa. Usa la de la vigilancia si tiene menos de `edadMax` ms.
 *  Devuelve null si no hay permiso o no se pudo en el tiempo dado. */
export async function tomarPunto(timeout = 20000, edadMax = 0): Promise<PuntoGPS | null> {
  if (ultimo && edadMax > 0 && Date.now() - new Date(ultimo.en).getTime() < edadMax) return ultimo;
  try {
    return aPunto(await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout, maximumAge: edadMax }));
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
export async function tomarEvidencia(timeout = 20000, edadMax = 0): Promise<{ punto: PuntoGPS | null; simulada: boolean }> {
  const punto = await tomarPunto(timeout, edadMax);
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
