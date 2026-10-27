import * as Location from "expo-location";
import { Magnetometer } from "expo-sensors";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";

type Position = {
  latitude: number;
  longitude: number;
};

// Página HTML com Leaflet + OpenStreetMap
const MAP_HTML = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
      html, body, #map { height: 100%; margin: 0; padding: 0; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script>
      let map = null;
      let marker = null;

      function showPosition(lat, lng) {
        if (!map) {
          map = L.map("map").setView([lat, lng], 16);
          L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          }).addTo(map);
        } else {
          map.setView([lat, lng], 16);
        }
        if (marker) {
          map.removeLayer(marker);
        }
        marker = L.marker([lat, lng])
          .addTo(map)
          .bindPopup("Estou aqui")
          .openPopup();
      }
    </script>
  </body>
</html>
`;

export default function Index() {
  const [position, setPosition] = useState<Position | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [angle, setAngle] = useState<number | null>(null);
  const [sensorMessage, setSensorMessage] = useState("");
  const webViewRef = useRef<WebView>(null);

  // Pede permissão e busca a localização do aparelho.
  useEffect(() => {
    let active = true;

    async function getLocation() {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!active) return;
        if (permission.status !== "granted") {
          setLocationError("A permissão de localização foi negada.");
          return;
        }
        const result = await Location.getCurrentPositionAsync({});
        if (active) {
          setPosition({
            latitude: result.coords.latitude,
            longitude: result.coords.longitude,
          });
        }
      } catch {
        if (active) {
          setLocationError("Não foi possível obter a localização.");
        }
      }
    }

    getLocation();
    return () => {
      active = false;
    };
  }, []);

  // Envia a posição para o mapa assim que ela chega.
  useEffect(() => {
    if (position) {
      webViewRef.current?.injectJavaScript(
        `showPosition(${position.latitude}, ${position.longitude}); true;`
      );
    }
  }, [position]);

  // Lê o magnetômetro e mostra um ângulo aproximado.
  useEffect(() => {
    let active = true;
    let subscription: ReturnType<typeof Magnetometer.addListener> | undefined;

    async function startMagnetometer() {
      try {
        const available = await Magnetometer.isAvailableAsync();
        if (!active) return;
        if (!available) {
          setSensorMessage("Magnetômetro indisponível neste emulador.");
          return;
        }
        Magnetometer.setUpdateInterval(500);
        subscription = Magnetometer.addListener(({ x, y }) => {
          const degrees = (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
          setAngle(Math.round(degrees));
        });
      } catch {
        if (active) {
          setSensorMessage("Não foi possível acessar o magnetômetro.");
        }
      }
    }

    startMagnetometer();
    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);

  if (locationError) {
    return (
      <View style={styles.messageScreen}>
        <Text>{locationError}</Text>
      </View>
    );
  }

  if (!position) {
    return (
      <View style={styles.messageScreen}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Buscando localização...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        style={styles.map}
        originWhitelist={["*"]}
        source={{ html: MAP_HTML }}
        onLoadEnd={() => {
          if (position) {
            webViewRef.current?.injectJavaScript(
              `showPosition(${position.latitude}, ${position.longitude}); true;`
            );
          }
        }}
      />

      <View style={styles.info}>
        <Text>Latitude: {position.latitude.toFixed(5)}</Text>
        <Text>Longitude: {position.longitude.toFixed(5)}</Text>
        <Text>
          Ângulo do magnetômetro: {angle === null ? "lendo..." : `${angle}°`}
        </Text>
        {sensorMessage ? <Text>{sensorMessage}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  info: {
    padding: 16,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#cccccc",
    gap: 6,
  },
  messageScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
  },
});