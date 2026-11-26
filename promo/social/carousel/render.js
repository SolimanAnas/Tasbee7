const {chromium}=require('playwright');const path=require('path');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1350}});
await p.goto('file://'+path.resolve(__dirname,'slides.html'));await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(800);
for(let i=1;i<=9;i++){await p.locator('#s'+i).screenshot({path:`out/slide-0${i}.png`});}
await b.close()})();
