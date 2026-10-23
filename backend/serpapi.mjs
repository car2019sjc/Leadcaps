export function serpapiProvider({key=process.env.SERPAPI_API_KEY,fetchImpl=fetch}={}) {
  return {enabled:!!key,name:'SerpAPI',async autocomplete(query,{country,language,client='chrome'},signal) {
    const safeError=(code,message)=>Object.assign(new Error(message),{code});
    const url=new URL('https://serpapi.com/search.json');
    url.search=new URLSearchParams({engine:'google_autocomplete',q:query,gl:country,hl:language,client,api_key:key,output:'json'});
    try {
      const response=await fetchImpl(url,{redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(35000)]):AbortSignal.timeout(35000)});
      if (!response.ok) throw safeError('search_http_'+response.status,response.status===429?'Limite da SerpAPI atingido. As consultas restantes foram interrompidas.':'A SerpAPI recusou a consulta. Confira chave e permissões na VPS.');
      if (Number(response.headers.get('content-length'))>1048576) throw safeError('search_invalid','Resposta da fonte excedeu o limite.');
      const body=await response.text();
      if (Buffer.byteLength(body)>1048576) throw safeError('search_invalid','Resposta da fonte excedeu o limite.');
      let data;try{data=JSON.parse(body);}catch{throw safeError('search_invalid','A fonte retornou uma resposta inválida.');}
      if (data?.error || data?.search_metadata?.status==='Error') throw safeError('search_provider_error','A fonte informou falha na consulta. Nenhuma expressão foi inventada para completar o resultado.');
      if (data?.search_metadata?.status!=='Success') throw safeError('search_unknown','Não foi possível confirmar a conclusão da consulta. Não haverá repetição automática.');
      const items=data.suggestions ?? [];
      if (!Array.isArray(items) || items.length>200 || items.some(item=>typeof item?.value!=='string' || item.value.trim().length<1 || item.value.length>300)) throw safeError('search_invalid','As expressões retornadas não passaram pela validação.');
      const created=Date.parse(data.search_metadata.created_at);
      return {items:items.map(item=>({text:item.value.trim()})),provider_id:typeof data.search_metadata.id==='string'?data.search_metadata.id.slice(0,100):null,provider_created_at:Number.isFinite(created)?new Date(created).toISOString():null};
    } catch(error) {
      if (/^search_/.test(error.code || '')) throw error;
      throw safeError('search_unknown','Conexão interrompida; o consumo da consulta é incerto. Não haverá repetição automática.');
    }
  }};
}
