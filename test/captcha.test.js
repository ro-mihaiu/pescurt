import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const loader = source.slice(source.indexOf('let captchaLoader;'), source.indexOf('\nfunction frame('));
function setup() {
  let script, timeout;
  const context = vm.createContext({window:{}, Promise, Error, setTimeout:fn => {timeout=fn; return 1;}, clearTimeout:()=>{}, document:{createElement:()=>({remove(){}}),head:{append:s=>{script=s;}}}});
  vm.runInContext(loader,context);
  return {context, script:()=>script, timeout:()=>timeout(), load:()=>vm.runInContext('captchaApi()',context)};
}
test('loaded explicit API resolves without invoking ready and shares pending load', async () => {
  const env=setup();
  const first=env.load();
  assert.equal(env.load(),first);
  const api={render(){},ready(){throw new Error('ready must not be called after script load');}};
  env.context.window.turnstile=api;
  env.script().onload();
  assert.equal(await first,api);
  assert.equal(await env.load(),api);
});
test('failed or stalled script rejects and allows a new loading attempt', async () => {
  for (const failure of ['error','timeout','missing-api']) {
    const env=setup();
    const first=env.load();
    const rejected=assert.rejects(first,/Turnstile unavailable/);
    const old=env.script();
    if(failure==='error') old.onerror();
    else if(failure==='timeout') env.timeout();
    else old.onload();
    await rejected;
    const retry=env.load();
    assert.notEqual(env.script(),old);
    env.context.window.turnstile={render(){}};
    env.script().onload();
    await retry;
  }
});
