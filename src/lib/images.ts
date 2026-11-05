import saude from "@/assets/news-saude.jpg";
import cidades from "@/assets/news-cidades.jpg";
import receitas from "@/assets/news-receitas.jpg";
import tecnologia from "@/assets/news-tecnologia.jpg";
import economia from "@/assets/news-economia.jpg";
import esportes from "@/assets/news-esportes.jpg";

const map: Record<string, string> = { saude, cidades, receitas, tecnologia, economia, esportes };

export function postImage(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.startsWith("http")) return key;
  return map[key] ?? null;
}
