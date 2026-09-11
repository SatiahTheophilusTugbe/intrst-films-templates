/* Run inside the rendered browser page after images and document.fonts.ready.
   Reject a nonempty result. These are layout checks, not editorial/rights approval. */
function intrstLayoutPreflight(format) {
  const issues=[];
  const visible=e=>e&&e.getBoundingClientRect().width&&e.getBoundingClientRect().height;
  const rect=s=>{const e=document.querySelector(s);return visible(e)?e.getBoundingClientRect():null};
  const overlap=(a,b)=>a&&b&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  const headlines={single:['.headline',4],carousel:['.headline',4],archive:['.headline',2],evidence:['.claim',2]};
  if(!headlines[format]) return ['Unknown format'];
  const [selector,maxLines]=headlines[format], h=document.querySelector(selector);
  if(!visible(h))issues.push('Missing headline');
  else {const lineHeight=parseFloat(getComputedStyle(h).lineHeight);if(h.getBoundingClientRect().height>lineHeight*maxLines+2)issues.push('Headline exceeds '+maxLines+' lines');}
  for(const selector of ['.top','.copy','.source-extract','.source-block','.meaning','.detail-block','.footer','.provenance','.source','.claim']){
    const r=rect(selector);if(r&&(r.left<0||r.top<0||r.right>1080.5||r.bottom>1350.5))issues.push('Outside canvas: '+selector);
  }
  for(const [a,b] of [['.source-extract','.copy'],['.claim','.source-block'],['.meaning','.detail-block'],['.source-block','.detail-block'],['.detail-block','.footer'],['.copy','.source'],['.copy','.provenance'],['.publication','.provenance'],['.deck-name','.source']])if(overlap(rect(a),rect(b)))issues.push('Overlap: '+a+' / '+b);
  for(const e of document.querySelectorAll('img'))if(!e.complete||!e.naturalWidth)issues.push('Missing image');
  if(document.fonts.status!=='loaded')issues.push('Fonts not ready');
  return issues;
}
if(typeof module!=='undefined')module.exports=intrstLayoutPreflight;
