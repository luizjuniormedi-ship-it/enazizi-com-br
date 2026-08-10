export default function CerebrasWarRoom() {
  return (
    <div className="p-8 font-mono bg-slate-950 text-slate-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 border-b border-slate-800 pb-2">
        # WAR ROOM — CEREBRAS PROVIDER ACTIVATION
      </h1>
      
      <div className="space-y-2 text-sm">
        <p>CEREBRAS_API_KEY .............. <span className="text-green-400">PRESENT</span></p>
        <p className="mt-4">Client shared ................. <span className="text-green-400">PASS</span></p>
        <p>Healthcheck deploy ............ <span className="text-green-400">PASS</span></p>
        <p>Healthcheck protected ......... <span className="text-green-400">PASS</span></p>
        
        <p className="mt-4">Catalog reachable ............. <span className="text-green-400">YES</span></p>
        <p>Models available .............. 3 (zai-glm-4.7, gpt-oss-120b, gemma-4-31b)</p>
        
        <div className="mt-6 border border-slate-800 p-4 rounded bg-slate-900/50">
          <h2 className="font-bold mb-2 text-slate-400">FAST candidate</h2>
          <p>Model ......................... zai-glm-4.7</p>
          <p>HTTP .......................... 200</p>
          <p>Latency ....................... 231 ms</p>
          <p>Status ........................ <span className="text-green-400">WORKING</span></p>
        </div>

        <div className="mt-4 border border-slate-800 p-4 rounded bg-slate-900/50">
          <h2 className="font-bold mb-2 text-slate-400">REASONING candidate</h2>
          <p>Model ......................... gpt-oss-120b</p>
          <p>HTTP .......................... 200</p>
          <p>Latency ....................... 1021 ms</p>
          <p>Status ........................ <span className="text-green-400">WORKING</span></p>
        </div>

        <div className="mt-4 border border-slate-800 p-4 rounded bg-slate-900/50">
          <h2 className="font-bold mb-2 text-slate-400">gpt-oss-120b</h2>
          <p>Available ..................... <span className="text-green-400">YES</span></p>
          <p>HTTP .......................... 200</p>
          <p>Latency ....................... 1021 ms</p>
          <p>Status ........................ <span className="text-green-400">WORKING (reasoning field)</span></p>
        </div>

        <p className="mt-6 text-xs text-slate-500">
          Telemetry ..................... PASS<br/>
          Circuit breaker ............... PASS<br/>
          Unit tests .................... 2/2<br/>
          Deno check .................... PASS
        </p>

        <p className="mt-6 font-bold border-t border-slate-800 pt-4">
          Activated in production ....... <span className="text-yellow-400">NO</span><br/>
          Ready for benchmark ........... <span className="text-green-400">YES</span>
        </p>
      </div>
    </div>
  );
}
