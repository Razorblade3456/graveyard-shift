import React, { useEffect, useRef, useState } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type * as Leaflet from 'leaflet';
import './leaflet-map.css';

type Coordinate={latitude:number;longitude:number};
type Event={nativeEvent:{coordinate:Coordinate}};
type Props={region:Coordinate;children?:React.ReactNode;style?:StyleProp<ViewStyle>;onPress?:(e:Event)=>void};
export function Circle(_props:{center:Coordinate;radius:number;strokeColor?:string;fillColor?:string}){return null;}
export function Marker(_props:{coordinate:Coordinate;draggable?:boolean;onDragEnd?:(e:Event)=>void}){return null;}
export default function WorkplaceMap(props:Props){
 const container=useRef<HTMLDivElement>(null),map=useRef<Leaflet.Map|null>(null),leaflet=useRef<typeof Leaflet|null>(null),circle=useRef<Leaflet.Circle|null>(null),marker=useRef<Leaflet.Marker|null>(null),latest=useRef(props);
 latest.current=props;
 const [ready,setReady]=useState(false),[notice,setNotice]=useState('');
 const radius=(React.Children.toArray(props.children).find(child=>React.isValidElement(child)&&child.type===Circle) as React.ReactElement<{radius:number}>|undefined)?.props.radius??200;
 useEffect(()=>{let disposed=false;let observer:ResizeObserver|undefined;
  import('leaflet').then(L=>{if(disposed||!container.current)return;leaflet.current=L;
   const center:Leaflet.LatLngExpression=[latest.current.region.latitude,latest.current.region.longitude];
   const m=L.map(container.current,{scrollWheelZoom:false}).setView(center,16);map.current=m;
   L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',crossOrigin:true,referrerPolicy:'strict-origin-when-cross-origin',maxZoom:19}).on('tileerror',()=>{if(!disposed)setNotice('Street tiles could not load. The pin and radius still work; check connectivity or retry the page.');}).addTo(m);
   marker.current=L.marker(center,{draggable:true,icon:L.divIcon({className:'graveyard-pin',html:'<span style="display:block;color:#b480ff;background:#160f20;border:2px solid #b480ff;border-radius:50%;width:28px;height:28px;text-align:center;line-height:24px;font-size:20px;box-shadow:0 2px 8px #000">✦</span>',iconSize:[28,28],iconAnchor:[14,14]})}).addTo(m);
   circle.current=L.circle(center,{radius,color:'#b480ff',weight:2,fillColor:'#b480ff',fillOpacity:.16}).addTo(m);
   m.on('click',event=>latest.current.onPress?.({nativeEvent:{coordinate:{latitude:event.latlng.lat,longitude:event.latlng.lng}}}));
   marker.current.on('dragend',()=>{const point=marker.current!.getLatLng();const child=React.Children.toArray(latest.current.children).find(c=>React.isValidElement(c)&&c.type===Marker) as React.ReactElement<{onDragEnd?:(e:Event)=>void}>|undefined;child?.props.onDragEnd?.({nativeEvent:{coordinate:{latitude:point.lat,longitude:point.lng}}});});
   if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(()=>m.invalidateSize());observer.observe(container.current);}
   m.invalidateSize();setReady(true);
  }).catch(()=>{if(!disposed)setNotice('The map could not initialize. Retry the page; saved records and manual tracking are unaffected.');});
  return()=>{disposed=true;observer?.disconnect();map.current?.remove();map.current=null;marker.current=null;circle.current=null;};
 },[]);
 useEffect(()=>{if(!ready||!leaflet.current||!map.current||!circle.current)return;const point:Leaflet.LatLngExpression=[props.region.latitude,props.region.longitude];marker.current?.setLatLng(point);circle.current.setLatLng(point).setRadius(radius);map.current.fitBounds(circle.current.getBounds(),{padding:[22,22],maxZoom:18,animate:false});},[ready,props.region.latitude,props.region.longitude,radius]);
 return <View style={{gap:8}}><View style={props.style}><div ref={container} aria-label="Profile location map; drag the pin or tap to choose a location" style={{height:'100%',width:'100%',minHeight:230,borderRadius:13,background:'#211a29',zIndex:0}}/></View>{!!notice&&<Text style={{fontSize:11,color:'#edaaaa'}}>{notice}</Text>}<Text style={{fontSize:10,color:'#9a94a6'}}>Street map by OpenStreetMap. Tile requests share the displayed map area with that provider. GPS diagnostics never contain your coordinates.</Text></View>;
}
