import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import { createApi } from '../backend/server.mjs';
import { migrate } from '../backend/db.mjs';
import { passwordHash } from '../backend/auth.mjs';
import { opportunityFixture, briefFixture } from './content-fixtures.mjs';
if (!process.env.TEST_DATABASE_URL) { console.log('UI editorial ignorada: configure TEST_DATABASE_URL de testes.'); process.exit(0); }
const admin=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL});
const schema='ui_content_'+randomUUID().replaceAll('-','');await admin.query(`CREATE SCHEMA ${schema}`);
const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,options:`-c search_path=${schema}`,max:4});
let browser, api, web, generated=0;
try {
  await mkdir('test-results',{recursive:true});await migrate(pool);
  await pool.query('INSERT INTO app_users(id,login,display_name,password_hash) VALUES($1,$2,$3,$4)',[randomUUID(),'editor','Editor fictício',await passwordHash('senha-ficticia-1234')]);
  api=await createApi({pool,origins:['http://127.0.0.1:8014'],contentProvider:{enabled:true,model:'modelo-ficticio-UI',maxTokens:4096,generate:async(action,input)=>{
    generated++;return {data:action==='opportunities'?{opportunities:[opportunityFixture(input.research)]}:briefFixture(input),usage:{input_tokens:100,output_tokens:200},model:'modelo-ficticio-UI'};
  }}});
  await new Promise(resolve=>api.listen(8328,'127.0.0.1',resolve));api.content.start();
  web=spawn(process.execPath,['scripts/serve.mjs','--port=8014'],{stdio:['ignore','pipe','inherit']});await once(web.stdout,'data');
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1440,height:1100}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/fonts.googleapis.com/**',r=>r.abort());await page.route('**/fonts.gstatic.com/**',r=>r.abort());
  await page.goto('http://127.0.0.1:8014',{waitUntil:'domcontentloaded'});
  await page.locator('#btnContent').click();assert.equal(await page.locator('#ciAuth').isVisible(),true);
  await page.locator('#ciConnect').click();await page.locator('#dbApi').fill('http://127.0.0.1:8328');await page.locator('#dbUsername').fill('editor');await page.locator('#dbPassword').fill('senha-ficticia-1234');await page.locator('#dbConnect').click();
  await page.waitForFunction(()=>document.getElementById('dbUser').textContent.includes('Editor fictício'));await page.locator('#basesClose').click();
  await page.locator('#btnContent').click();await page.waitForFunction(()=>document.getElementById('ciConfig').textContent.includes('modelo-ficticio-UI'));
  await page.locator('#ciService').fill('Serviços gerenciados de TI');await page.locator('#ciAudience').fill('Gestores de TI de indústrias');await page.locator('#ciGoal').fill('Organizar conversas de diagnóstico');await page.locator('#ciTheme').fill('Recorrência de incidentes');
  await page.locator('#ciSource').fill('Pesquisa fictícia <img src=x onerror=alert(1)>');await page.locator('#ciSignals').fill('Como reduzir incidentes recorrentes?\nComo não repetir uma falha?');
  await page.locator('#ciProfile').click();assert.match(await page.locator('#ciProfilePreview').textContent(),/base fictícia/);
  await page.locator('#ciSaveResearch').click();await page.waitForFunction(()=>!document.getElementById('ciResearchResult').hidden);
  assert.equal(generated,0,'Salvar não pode fazer chamada paga');
  await page.locator('#ciAnalyze').click();await page.waitForFunction(()=>document.querySelectorAll('.ci-opportunity').length===1);
  assert.equal(generated,1);assert.match(await page.locator('#ciOpportunities').textContent(),/Prioridade incompleta/);assert.equal(await page.locator('#ciEvidence img').count(),0);
  await page.locator('[data-ci-select]').click();await page.locator('#ciOtitle').fill('Checklist revisado pelo editor');
  assert.equal(await page.locator('#ciGenerateBrief').isDisabled(),true);
  await page.locator('#ciOpportunityForm button[type=submit]').click();await page.waitForFunction(()=>document.getElementById('ciPriority').textContent.includes('Revisão 2'));
  await page.locator('#ciGenerateBrief').click();await page.waitForFunction(()=>!document.getElementById('ciBriefSection').hidden);
  assert.equal(generated,2);assert.equal(await page.locator('#ciExport').isDisabled(),true);
  await page.locator('#ciBpromise').fill('Promessa editorial revisada com evidências disponíveis');await page.locator('#ciSaveBrief').click();await page.waitForFunction(()=>document.getElementById('ciBriefStatus').textContent.includes('Versão 2'));
  await page.locator('#ciReviewed').check();await page.locator('#ciApprove').click();await page.waitForFunction(()=>document.getElementById('ciBriefStatus').textContent.includes('aprovada por'));
  const downloadPromise=page.waitForEvent('download');await page.locator('#ciExport').click();const download=await downloadPromise;assert.match(download.suggestedFilename(),/v2\.md$/);
  await page.locator('#ciBriefSection').scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/conteudo-briefing-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  const bounds=await page.locator('.ci-shell').boundingBox();
  assert.ok(bounds.x>=0 && bounds.x+bounds.width<=391,'A janela editorial deve caber na largura do celular');
  await page.locator('#ciBriefStatus').scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/conteudo-briefing-mobile.png'});
  await page.locator('#ciClose').click();await page.locator('#btnBases').click();await page.locator('#dbLogout').click();
  await page.waitForFunction(()=>document.getElementById('dbLogin').hidden===false);
  assert.equal(await page.locator('#ciBriefFields').textContent(),'');assert.equal(errors.length,0,errors.join('\n'));
  console.log('UI editorial real com PostgreSQL e Anthropic simulada: contexto, perfil agregado, pesquisa sem consumo, geração, revisão, versões, aprovação, exportação e limpeza no logout — OK. Nenhuma chamada paga.');
} finally {
  if(browser)await browser.close();if(web)web.kill();if(api){await api.content.stop();await new Promise(resolve=>{api.close(resolve);api.closeAllConnections();});}
  await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();
}
