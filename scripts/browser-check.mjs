import { chromium } from 'playwright';
import { createServer } from '../src/server.js';
import { Store } from '../src/store.js';
import assert from 'node:assert/strict';
const admin='ui-test-only-admin-token-123456789';
const store=new Store(null,admin),server=createServer(store);
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});
try {
 const context=await browser.newContext({viewport:{width:1440,height:1000}}), page=await context.newPage();
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url); await page.locator('#adminToken').fill(admin);await page.locator('#login button').click();await page.locator('#management').waitFor({state:'visible'});
 await page.locator('#newCourt').click();await page.locator('#courtForm [name=name]').fill('Cancha Central');await page.locator('#courtForm button').last().click();
 await page.locator('#newMatch').click();await page.locator('#matchForm [name=home]').fill('Pareja Verde');await page.locator('#matchForm [name=away]').fill('Pareja Azul');await page.selectOption('#preset','padel-star');await page.locator('#matchForm button').last().click();
 await page.locator('[data-start]').click();await page.locator('#newScreen').click();await page.locator('#screenForm [name=name]').fill('TV Central');await page.locator('#screenForm button').last().click();await page.locator('#screens a').waitFor();
 const link=await page.locator('#screens a').getAttribute('href');const display=await context.newPage();display.on('pageerror',e=>errors.push(e.message));await display.goto(url+link);await display.locator('.score').first().waitFor();
 await page.locator('[data-pairing]').click();await display.locator('#pairCode').filter({hasText:'Enlace:'}).waitFor();
 const code=store.data.screens[0].pairing.code;
 const controls=await browser.newContext({viewport:{width:390,height:844}}), control=await controls.newPage();control.on('pageerror',e=>errors.push(e.message));await control.goto(url);await control.locator('#controlTab').click();await control.locator('[data-connect]').click();await control.locator('#pairForm [name=name]').fill('Tablet oficial');await control.locator('#pairForm [name=code]').fill(code);await control.locator('#pairForm button').last().click();await control.locator('[data-point="0"]').waitFor();await control.locator('[data-point="0"]').click();await control.waitForFunction(()=>document.querySelector('.points')?.textContent==='15');await display.waitForFunction(()=>document.querySelector('.points')?.textContent==='15');
 await control.screenshot({path:'sports-mobile.png'});await display.screenshot({path:'sports-screen.png'});
 assert.equal(await control.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await controls.setOffline(true);await control.waitForFunction(()=>document.querySelector('#live').classList.contains('offline'));assert.equal(await control.locator('[data-point="0"]').isDisabled(),true);
 await controls.setOffline(false);await control.waitForFunction(()=>!document.querySelector('#live').classList.contains('offline'));await control.locator('#undo').click();await control.waitForFunction(()=>document.querySelector('.points')?.textContent==='0');
 assert.deepEqual(errors,[]);console.log('UI PASS: setup, Star Point preset, pairing, two viewers, mobile width, scoring, disconnect, reconnect, undo.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
