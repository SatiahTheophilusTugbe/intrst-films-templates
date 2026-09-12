/* Browser gate; call after fonts.ready. expected maps exact img src to SHA-256.
 Pixel blank-control/geometry/visual gates remain mandatory in the external harness. */
async function intrstImageBindingGate(expected) {
 const results=[];
 for(const img of document.images){
  const box=img.getBoundingClientRect();
  let active=box.width>0&&box.height>0;
  for(let e=img;e;e=e.parentElement){const s=getComputedStyle(e);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)active=false;}
  if(!active)continue;
  const result={complete:img.complete,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,pass:false};
  try{await img.decode();const src=img.currentSrc||img.src;if(!expected[src])throw Error('Unregistered image');const response=await fetch(src);if(!response.ok)throw Error('Image fetch failed');const bytes=await response.arrayBuffer();result.sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');result.complete=img.complete;result.naturalWidth=img.naturalWidth;result.naturalHeight=img.naturalHeight;result.pass=img.complete&&img.naturalWidth>0&&img.naturalHeight>0&&result.sha256===expected[src];}catch(error){result.error=error.message;}
  results.push(result);
 }
 return {pass:results.length===Object.keys(expected).length&&results.length>0&&results.every(r=>r.pass),images:results};
}
