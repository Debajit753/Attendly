import React, { useRef, useState } from 'react';
import { View, Text, Pressable, Modal, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../theme';

const html = (lat: number, lng: number, radius: number) => `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  html,body,#map{height:100%;margin:0;padding:0;background:#e9eeeb}
  #pin{position:absolute;left:50%;top:50%;transform:translate(-50%,-100%);z-index:1000;pointer-events:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.3))}
  #dot{position:absolute;left:50%;top:50%;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:#16A34A;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.15);z-index:1000;pointer-events:none}
</style></head><body>
<div id="map"></div>
<div id="pin"><svg width="36" height="48" viewBox="0 0 24 32"><path d="M12 0C5.4 0 0 5.4 0 12c0 8.4 12 20 12 20s12-11.6 12-20C24 5.4 18.6 0 12 0z" fill="#16A34A" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="12" r="4.3" fill="#fff"/></svg></div>
<div id="dot"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var post=function(o){ if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(o)); };
  try {
    var map = L.map('map',{zoomControl:true}).setView([${lat}, ${lng}], 17);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
    var circle = L.circle([${lat}, ${lng}], {radius:${radius}, color:'#16A34A', weight:2, fillColor:'#16A34A', fillOpacity:0.12}).addTo(map);
    function update(){ var c=map.getCenter(); circle.setLatLng(c); post({lat:c.lat,lng:c.lng}); }
    map.on('move', function(){ circle.setLatLng(map.getCenter()); });
    map.on('moveend', update);
    window.setRadius = function(r){ circle.setRadius(r); };
    window.recenter = function(la,ln){ map.setView([la,ln],17); update(); };
    update();
  } catch(err){ post({error:String(err)}); }
</script></body></html>`;

export function MapPicker({ pal, initial, onSave, onClose }: {
  pal: Palette;
  initial: { lat: number | null; lng: number | null; radius: number };
  onClose: () => void;
  onSave: (loc: { lat: number; lng: number; radius: number }) => void;
}) {
  const webRef = useRef<WebView>(null);
  const start = { lat: initial.lat ?? 20.5937, lng: initial.lng ?? 78.9629 }; // fallback: India centre
  const [coords, setCoords] = useState({ lat: start.lat, lng: start.lng });
  const [radius, setRadius] = useState(initial.radius || 100);

  async function locateMe() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const la = pos.coords.latitude, ln = pos.coords.longitude;
      setCoords({ lat: la, lng: ln });
      webRef.current?.injectJavaScript(`window.recenter(${la},${ln}); true;`);
    } catch { /* ignore */ }
  }
  function changeRadius(r: number) { setRadius(r); webRef.current?.injectJavaScript(`window.setRadius(${r}); true;`); }

  const shadow = { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 } as const;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: pal.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'web' ? 16 : 52, paddingBottom: 12, backgroundColor: pal.surface }}>
          <Pressable onPress={onClose} hitSlop={8}><Text style={{ color: pal.brand, fontSize: 16, fontWeight: '600' }}>Cancel</Text></Pressable>
          <Text style={{ color: pal.text, fontWeight: '700', fontSize: 16 }}>Pick your building</Text>
          <Pressable onPress={() => onSave({ lat: coords.lat, lng: coords.lng, radius })} hitSlop={8}><Text style={{ color: pal.brand, fontSize: 16, fontWeight: '700' }}>Save</Text></Pressable>
        </View>
        <View style={{ flex: 1 }}>
          {Platform.OS === 'web' ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: pal.surfaceAlt }}>
              <Ionicons name="map-outline" size={44} color={pal.textMuted} />
              <Text style={{ color: pal.text, fontWeight: '600', fontSize: 15, marginTop: 12, textAlign: 'center' }}>The interactive map opens on your phone</Text>
              <Text style={{ color: pal.textSecondary, fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 19 }}>Tap the ◎ button below to use your current location, then Save.{'\n'}Selected: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</Text>
            </View>
          ) : (
            <WebView
              ref={webRef}
              originWhitelist={['*']}
              source={{ html: html(start.lat, start.lng, radius) }}
              onMessage={(e) => { try { const d = JSON.parse(e.nativeEvent.data); if (d.lat) setCoords({ lat: d.lat, lng: d.lng }); } catch { /* */ } }}
              style={{ flex: 1, backgroundColor: pal.surfaceAlt }}
            />
          )}
          <Pressable onPress={locateMe} style={[{ position: 'absolute', right: 16, bottom: 16, backgroundColor: pal.surface, borderRadius: 999, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }, shadow]}>
            <Ionicons name="locate" size={22} color={pal.brand} />
          </Pressable>
        </View>
        <View style={{ padding: 16, paddingBottom: Platform.OS === 'web' ? 16 : 32, backgroundColor: pal.surface }}>
          <Text style={{ color: pal.textSecondary, fontSize: 13, lineHeight: 18 }}>Move the map so your building sits under the pin, then pick a radius.</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            {[50, 100, 150, 250].map(r => (
              <Pressable key={r} onPress={() => changeRadius(r)} style={{ flex: 1, backgroundColor: r === radius ? pal.brand : pal.surfaceAlt, borderRadius: 999, paddingVertical: 9, alignItems: 'center' }}>
                <Text style={{ color: r === radius ? '#fff' : pal.text, fontWeight: '600', fontSize: 13 }}>{r}m</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}
