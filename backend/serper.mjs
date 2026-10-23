export function serperProvider({key=process.env.SERPER_API_KEY,fetchImpl=fetch}={}) {
  return {enabled:!!key?.trim(),name:'Serper',async autocomplete(query,{country,language},signal) {
    const fail=code=>Object.assign(new Error('A consulta Serper não pôde ser concluída. Confira chave, saldo e parâmetros na VPS.'),{code});
    try {
      const response=await fetchImpl('https://google.serper.dev/autocomplete',{
        method:'POST',redirect:'error',
        headers:{'Content-Type':'application/json','X-API-KEY':key},
        body:JSON.stringify({q:query,gl:country,hl:language}),
        signal:signal?AbortSignal.any([signal,AbortSignal.timeout(35000)]):AbortSignal.timeout(35000)
      });
      if(!response.ok)throw fail('search_http_'+response.status);
      if(Number(response.headers.get('content-length'))>1048576)throw fail('search_invalid');
      const body=await response.text();
      if(Buffer.byteLength(body)>1048576)throw fail('search_invalid');
      let data;try{data=JSON.parse(body);}catch{throw fail('search_invalid');}
      if(data?.error||data?.message||Number(data?.statusCode)>=400)throw fail('search_provider_error');
      if(!Array.isArray(data?.suggestions)||data.suggestions.length>200||data.suggestions.some(item=>typeof item?.value!=='string'||!item.value.trim()||item.value.length>300))throw fail('search_invalid');
      // Serper autocomplete does not supply the SerpAPI search ID or creation date.
      return {items:data.suggestions.map(item=>({text:item.value.trim()})),provider_id:null,provider_created_at:null};
    }catch(error){
      if(/^search_/.test(error.code||''))throw error;
      throw fail('search_unknown');
    }
  }};
}
