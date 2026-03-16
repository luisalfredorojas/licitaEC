"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, X, Loader2 } from "lucide-react";

interface CpcCode {
  code: string;
  description: string;
}

interface CpcSelectorProps {
  selected: CpcCode[];
  onChange: (codes: CpcCode[]) => void;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function CpcSelector({ selected, onChange }: CpcSelectorProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CpcCode[]>([]);
  const [loading, setLoading] = useState(false);

  const debouncedQuery = useDebounce(query, 300);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cpc?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    search(debouncedQuery);
  }, [debouncedQuery, search]);

  function addCode(code: CpcCode) {
    if (!selected.find((s) => s.code === code.code)) {
      onChange([...selected, code]);
    }
    setQuery("");
  }

  function removeCode(code: string) {
    onChange(selected.filter((s) => s.code !== code));
  }

  const filteredResults = results.filter(
    (r) => !selected.find((s) => s.code === r.code)
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Buscar por código CPC o descripción..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
        )}
      </div>

      {filteredResults.length > 0 && (
        <div className="border rounded-lg divide-y max-h-48 overflow-y-auto bg-white shadow-sm">
          {filteredResults.map((cpc) => (
            <button
              key={cpc.code}
              type="button"
              onClick={() => addCode(cpc)}
              className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors flex items-center justify-between gap-2 group"
            >
              <div>
                <span className="font-mono text-xs font-medium text-[#1E40AF] bg-blue-50 px-1.5 py-0.5 rounded">
                  {cpc.code}
                </span>
                <span className="ml-2 text-sm text-gray-700">{cpc.description}</span>
              </div>
              <span className="text-xs text-[#1E40AF] opacity-0 group-hover:opacity-100 flex-shrink-0">
                + Agregar
              </span>
            </button>
          ))}
        </div>
      )}

      {selected.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">
            Códigos seleccionados ({selected.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {selected.map((cpc) => (
              <Badge
                key={cpc.code}
                variant="secondary"
                className="gap-1.5 pr-1 text-sm"
              >
                <span className="font-mono font-medium">{cpc.code}</span>
                <span className="text-gray-600 max-w-[200px] truncate">{cpc.description}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 ml-1 hover:bg-red-100 rounded-full"
                  onClick={() => removeCode(cpc.code)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {selected.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-4 border-2 border-dashed rounded-lg">
          Busca y selecciona los códigos CPC que describen tu actividad económica
        </p>
      )}
    </div>
  );
}
