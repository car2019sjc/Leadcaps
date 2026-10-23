import {serperProvider} from './serper.mjs';
import {serpapiProvider} from './serpapi.mjs';

export function searchProvider({env=process.env,fetchImpl=fetch}={}) {
  const selected=(env.SEARCH_PROVIDER||'').trim().toLowerCase()||(env.SERPER_API_KEY?.trim()?'serper':env.SERPAPI_API_KEY?.trim()?'serpapi':'serper');
  if(selected==='serper')return serperProvider({key:env.SERPER_API_KEY||'',fetchImpl});
  if(selected==='serpapi')return serpapiProvider({key:env.SERPAPI_API_KEY||'',fetchImpl});
  throw new Error('SEARCH_PROVIDER deve ser serper ou serpapi.');
}
