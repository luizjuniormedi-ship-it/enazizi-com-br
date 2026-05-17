
import re
import os

path = 'src/components/admin/AdminIngestionPanel.tsx'
if os.path.exists(path):
    with open(path, 'r') as f:
        content = f.read()

    # Pattern for the polling fetch
    pattern = r'const pollResp = await fetch\(`\$\{import\.meta\.env\.VITE_SUPABASE_URL\}/functions/v1/bulk-generate-content\?job_id=\$\{jobId\}`,\s*\{\s*method:\s*"GET",\s*headers:\s*\{\s*Authorization:\s*`Bearer \$\{pollToken\}`\s*\},\s*\}\);\s*const pollData = await pollResp\.json\(\);'
    
    replacement = 'const { data: pollData, error: pollError } = await supabase.functions.invoke(`bulk-generate-content?job_id=${jobId}`, { method: "GET" });\n                if (pollError) throw pollError;'
    
    new_content = re.sub(pattern, replacement, content, flags=re.MULTILINE)
    
    if new_content != content:
        with open(path, 'w') as f:
            f.write(new_content)
        print("Success")
    else:
        print("No match found")
else:
    print("File not found")
