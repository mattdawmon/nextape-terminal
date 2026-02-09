import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation, LANGUAGES } from "@/i18n";

export function LanguageSwitcher() {
  const { language, setLanguage } = useTranslation();
  const current = LANGUAGES.find(l => l.id === language);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" data-testid="button-language-switcher">
          <Globe className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.id}
            onClick={() => setLanguage(lang.id)}
            className={language === lang.id ? "bg-secondary" : ""}
            data-testid={`lang-option-${lang.id}`}
          >
            <span className="text-xs font-medium">{lang.nativeLabel}</span>
            {lang.id !== "en" && (
              <span className="ml-2 text-[10px] text-muted-foreground">({lang.label})</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
