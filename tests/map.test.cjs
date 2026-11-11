const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const React=require('react'),{act}=React,{createRoot}=require('react-dom/client'),{JSDOM}=require('jsdom');
test('web map renders a real draggable pin and updates its actual Leaflet position/radius from a GPS draft',async()=>{
 const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'https://tracker.example.test'});
 const names=['window','document','navigator','HTMLElement','SVGElement','Element','getComputedStyle','IS_REACT_ACT_ENVIRONMENT'],original=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
 for(const name of names)Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:name==='IS_REACT_ACT_ENVIRONMENT'?true:name==='getComputedStyle'?dom.window.getComputedStyle.bind(dom.window):dom.window[name]});
 dom.window.SVGSVGElement.prototype.createSVGRect=()=>({});Object.defineProperty(dom.window.HTMLElement.prototype,'clientWidth',{get:()=>600});Object.defineProperty(dom.window.HTMLElement.prototype,'clientHeight',{get:()=>230});
 const L=require('leaflet'),positions=[],radii=[];const oldPosition=L.Marker.prototype.setLatLng,oldRadius=L.Circle.prototype.setRadius;
 L.Marker.prototype.setLatLng=function(point){positions.push(point);return oldPosition.call(this,point);};L.Circle.prototype.setRadius=function(radius){radii.push(radius);return oldRadius.call(this,radius);};
 const file=path.join(__dirname,'../src/WorkplaceMap.web.tsx'),module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const root=createRoot(document.getElementById('root'));try{
  vm.runInNewContext(code,{module,exports:module.exports,require:id=>id.endsWith('.css')?{}:id==='react-native'?{View:({children})=>React.createElement('div',null,children),Text:({children})=>React.createElement('span',null,children)}:require(id),window,document,console,ResizeObserver:undefined});
  const {default:MapView,Marker,Circle}=module.exports;
  const render=(latitude,longitude,radius)=>React.createElement(MapView,{region:{latitude,longitude},style:{height:230}},React.createElement(Marker,{coordinate:{latitude,longitude},draggable:true}),React.createElement(Circle,{center:{latitude,longitude},radius}));
  await act(async()=>{root.render(render(0,0,200));await new Promise(resolve=>setTimeout(resolve,10));});
  assert.ok(document.querySelector('.leaflet-container'));assert.ok(document.querySelector('.graveyard-pin'));assert.ok(document.querySelector('.leaflet-overlay-pane path'));
  await act(async()=>{root.render(render(47.5,-122.3,600));});
  const last=positions.at(-1);assert.equal(last[0],47.5);assert.equal(last[1],-122.3);assert.equal(radii.at(-1),600);
 }finally{await act(async()=>root.unmount());L.Marker.prototype.setLatLng=oldPosition;L.Circle.prototype.setRadius=oldRadius;dom.window.close();for(const [name,value] of original){if(value)Object.defineProperty(globalThis,name,value);else delete globalThis[name];}}
});
