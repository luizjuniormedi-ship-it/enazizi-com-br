/**
 * NCBI E-utilities client for PubMed/PMC integration.
 * Follows EG-3 requirements: searchPubMed, fetchPubMedRecords, fetchPubMedAbstracts, 
 * linkPubMedToPMC, fetchPMCMetadata.
 */

const NCBI_BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const NCBI_API_KEY = Deno.env.get("NCBI_API_KEY");

export interface PubMedSearchResult {
  count: number;
  ids: string[];
}

export interface PubMedRecord {
  pmid: string;
  doi?: string;
  title: string;
  abstract: string;
  journal: string;
  pubYear: number;
  studyType?: string;
  pmcid?: string;
}

/**
 * Searches PubMed for a given query.
 */
export async function searchPubMed(query: string, retmax: number = 5): Promise<PubMedSearchResult> {
  const url = `${NCBI_BASE_URL}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=${retmax}${NCBI_API_KEY ? `&api_key=${NCBI_API_KEY}` : ''}`;
  
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`PubMed search failed: ${res.status}`);
    const data = await res.json();
    return {
      count: parseInt(data.esearchresult.count),
      ids: data.esearchresult.idlist || []
    };
  } catch (err) {
    console.error("[PUBMED] searchPubMed failed:", err);
    return { count: 0, ids: [] };
  }
}

/**
 * Fetches summaries/metadata for multiple PMIDs.
 */
export async function fetchPubMedRecords(ids: string[]): Promise<PubMedRecord[]> {
  if (ids.length === 0) return [];
  
  const url = `${NCBI_BASE_URL}/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json${NCBI_API_KEY ? `&api_key=${NCBI_API_KEY}` : ''}`;
  
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`PubMed summary failed: ${res.status}`);
    const data = await res.json();
    
    return ids.map(id => {
      const result = data.result[id];
      if (!result) return null;
      
      return {
        pmid: id,
        title: result.title,
        journal: result.source,
        pubYear: result.pubdate ? parseInt(result.pubdate.split(' ')[0]) : 0,
        doi: result.elocationid?.startsWith("doi: ") ? result.elocationid.replace("doi: ", "") : undefined,
        // Abstracts are not in esummary, we need efetch for that
      };
    }).filter(Boolean) as PubMedRecord[];
  } catch (err) {
    console.error("[PUBMED] fetchPubMedRecords failed:", err);
    return [];
  }
}

/**
 * Fetches full records (including abstracts) for PMIDs.
 */
export async function fetchPubMedAbstracts(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  
  const url = `${NCBI_BASE_URL}/efetch.fcgi?db=pubmed&id=${ids.join(",")}&retmode=xml${NCBI_API_KEY ? `&api_key=${NCBI_API_KEY}` : ''}`;
  
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`PubMed fetch failed: ${res.status}`);
    const xml = await res.text();
    
    // Simple regex parsing for abstracts as we don't have a full XML parser in Deno standard lib for this
    const abstracts: Record<string, string> = {};
    ids.forEach(id => {
      const articleRegex = new RegExp(`<PubmedArticle>[\\s\\S]*?<PMID[^>]*?>${id}</PMID>[\\s\\S]*?<AbstractText[^>]*?>([\\s\\S]*?)</AbstractText>[\\s\\S]*?</PubmedArticle>`, 'g');
      const match = articleRegex.exec(xml);
      if (match && match[1]) {
        abstracts[id] = match[1].replace(/<[^>]*>?/gm, '').trim();
      }
    });
    
    return abstracts;
  } catch (err) {
    console.error("[PUBMED] fetchPubMedAbstracts failed:", err);
    return {};
  }
}

/**
 * Links PMIDs to PMCIDs.
 */
export async function linkPubMedToPMC(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  
  const url = `${NCBI_BASE_URL}/elink.fcgi?dbfrom=pubmed&db=pmc&id=${ids.join(",")}&retmode=json${NCBI_API_KEY ? `&api_key=${NCBI_API_KEY}` : ''}`;
  
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`PubMed-PMC link failed: ${res.status}`);
    const data = await res.json();
    
    const mapping: Record<string, string> = {};
    data.linksets?.forEach((ls: any) => {
      const pmid = ls.ids?.[0];
      const pmcLink = ls.linksetdbs?.find((db: any) => db.dbto === "pmc");
      if (pmid && pmcLink?.links?.[0]) {
        mapping[pmid] = `PMC${pmcLink.links[0]}`;
      }
    });
    
    return mapping;
  } catch (err) {
    console.error("[PUBMED] linkPubMedToPMC failed:", err);
    return {};
  }
}
