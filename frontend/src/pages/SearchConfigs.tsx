import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, FileText, Calendar, Loader2, ChevronsUpDown, X, Regex, History } from "lucide-react";
import { searchConfigurations } from "@/services/search";
import { getCategories, Category } from "@/services/categories";
import { useDevices } from "@/hooks/useDevices";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

const SearchConfigs = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [daysFilter, setDaysFilter] = useState("all");
  const [latestOnly, setLatestOnly] = useState(false);
  const [regexMode, setRegexMode] = useState(false);
  const [regexError, setRegexError] = useState<string | null>(null);
  const [submittedTerm, setSubmittedTerm] = useState("");
  const [submittedDevices, setSubmittedDevices] = useState<string[]>([]);
  const [submittedCategory, setSubmittedCategory] = useState<string | undefined>();
  const [submittedDays, setSubmittedDays] = useState<number | undefined>();
  const [submittedLatestOnly, setSubmittedLatestOnly] = useState(false);
  const [submittedRegexMode, setSubmittedRegexMode] = useState(false);
  const [devicePopoverOpen, setDevicePopoverOpen] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation("search");
  const { t: tc } = useTranslation("common");

  // Fetch devices for filter
  const { data: devicesData, isLoading: devicesLoading } = useDevices({ page: 1, page_size: 100 });
  const devices = devicesData?.items || [];
  const [deviceSearch, setDeviceSearch] = useState("");

  // Fetch categories for filter
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  const handleSearch = () => {
    const term = searchTerm.trim();
    if (term.length < 2) return;
    // Validate regex before submitting
    if (regexMode) {
      try {
        new RegExp(term);
        setRegexError(null);
      } catch (e: any) {
        setRegexError(e.message);
        return;
      }
    } else {
      setRegexError(null);
    }
    setSubmittedTerm(term);
    setSubmittedDevices([...selectedDevices]);
    setSubmittedCategory(categoryFilter !== "all" ? categoryFilter : undefined);
    setSubmittedDays(daysFilter !== "all" ? parseInt(daysFilter) : undefined);
    setSubmittedLatestOnly(latestOnly);
    setSubmittedRegexMode(regexMode);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const toggleDevice = (deviceId: string) => {
    setSelectedDevices((prev) =>
      prev.includes(deviceId)
        ? prev.filter((id) => id !== deviceId)
        : [...prev, deviceId]
    );
  };

  const clearDevices = () => {
    setSelectedDevices([]);
  };

  const { data, isLoading } = useQuery({
    queryKey: ["search-configs", submittedTerm, submittedDevices, submittedCategory, submittedDays, submittedLatestOnly, submittedRegexMode],
    queryFn: () => searchConfigurations({
      q: submittedTerm,
      page: 1,
      page_size: 50,
      device_ids: submittedDevices.length > 0 ? submittedDevices : undefined,
      category_id: submittedCategory,
      days: submittedDays,
      latest_only: submittedLatestOnly || undefined,
      regex_mode: submittedRegexMode || undefined,
    }),
    enabled: submittedTerm.length >= 2,
  });

  const searchResults = data?.items || [];

  const highlightText = (text: string, highlight: string, isRegex: boolean) => {
    if (!highlight) return text;
    try {
      const pattern = isRegex ? highlight : highlight.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const parts = text.split(new RegExp(`(${pattern})`, "gi"));
      return (
        <span>
          {parts.map((part, i) =>
            new RegExp(`^(${pattern})$`, "gi").test(part) ? (
              <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">
                {part}
              </mark>
            ) : (
              part
            )
          )}
        </span>
      );
    } catch {
      return <span>{text}</span>;
    }
  };

  const deviceCount = useMemo(() => {
    const ids = new Set(searchResults.map((r) => r.device_id));
    return ids.size;
  }, [searchResults]);

  const selectedDeviceNames = useMemo(() => {
    return devices
      .filter((d) => selectedDevices.includes(d.id))
      .map((d) => d.name);
  }, [devices, selectedDevices]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            {t("label")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("placeholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="pl-10"
                />
              </div>
              <Button onClick={handleSearch} disabled={searchTerm.trim().length < 2 || isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("button")}
              </Button>
            </div>

            {/* Regex error */}
            {regexError && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <Regex className="h-4 w-4" />
                {t("regexError")}: {regexError}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {/* Device Multi-Select */}
              <Popover open={devicePopoverOpen} onOpenChange={setDevicePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={devicePopoverOpen}
                    className="w-[250px] justify-between"
                  >
                    <span className="truncate">
                      {selectedDevices.length === 0
                        ? t("allDevices")
                        : t("devicesSelected", { count: selectedDevices.length })}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder={tc("search")}
                      value={deviceSearch}
                      onValueChange={setDeviceSearch}
                    />
                    <CommandList>
                      {devicesLoading ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                          {tc("loading")}
                        </div>
                      ) : devices.length === 0 ? (
                        <CommandEmpty>{tc("noData")}</CommandEmpty>
                      ) : (
                        <CommandGroup>
                          {devices
                            .filter((device) =>
                              deviceSearch === "" ||
                              device.name.toLowerCase().includes(deviceSearch.toLowerCase()) ||
                              device.ip_address.includes(deviceSearch)
                            )
                            .map((device) => (
                              <CommandItem
                                key={device.id}
                                value={device.id}
                                onSelect={() => toggleDevice(device.id)}
                              >
                                <Checkbox
                                  checked={selectedDevices.includes(device.id)}
                                  className="mr-2"
                                />
                                <span className="flex-1 truncate">{device.name}</span>
                                <span className="text-xs text-muted-foreground ml-2">
                                  {device.ip_address}
                                </span>
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                  {selectedDevices.length > 0 && (
                    <div className="border-t p-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-muted-foreground"
                        onClick={clearDevices}
                      >
                        <X className="h-4 w-4 mr-2" />
                        {t("clearSelection")}
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>

              {/* Category Select */}
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t("allCategories")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allCategories")}</SelectItem>
                  {categories.map((category: Category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Period Select */}
              <Select value={daysFilter} onValueChange={setDaysFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t("allPeriods")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allPeriods")}</SelectItem>
                  <SelectItem value="7">{t("last7days")}</SelectItem>
                  <SelectItem value="30">{t("last30days")}</SelectItem>
                  <SelectItem value="90">{t("last90days")}</SelectItem>
                  <SelectItem value="365">{t("lastYear")}</SelectItem>
                </SelectContent>
              </Select>

              {/* Latest only toggle */}
              <button
                type="button"
                onClick={() => setLatestOnly(!latestOnly)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
                  latestOnly
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-input text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
                title={t("latestOnlyDesc")}
              >
                <History className="h-4 w-4" />
                {t("latestOnly")}
              </button>

              {/* Regex mode toggle */}
              <button
                type="button"
                onClick={() => { setRegexMode(!regexMode); setRegexError(null); }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
                  regexMode
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-input text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
                title={t("regexModeDesc")}
              >
                <Regex className="h-4 w-4" />
                {t("regexMode")}
              </button>
            </div>

            {/* Selected devices badges */}
            {selectedDeviceNames.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedDeviceNames.map((name, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Loading progress bar */}
      {isLoading && (
        <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary"
            style={{
              animation: "indeterminate-progress 1.4s ease-in-out infinite",
            }}
          />
        </div>
      )}

      {/* Results */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          {isLoading ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t("loading")}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("results", { results: data?.total || 0, devices: deviceCount })}
            </p>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="h-5 w-48 bg-muted rounded" />
                      <div className="h-4 w-64 bg-muted rounded" />
                    </div>
                    <div className="h-6 w-20 bg-muted rounded-full" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[1, 2].map((j) => (
                      <div key={j} className="p-3 rounded-lg bg-muted/50 border">
                        <div className="flex gap-3">
                          <div className="h-5 w-10 bg-muted rounded" />
                          <div className="h-4 flex-1 bg-muted rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : searchResults.length === 0 ? (
          <div className="text-sm text-muted-foreground">{t("noResults")}</div>
        ) : (
          searchResults.map((result) => (
            <Card key={result.configuration_id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{result.device_name}</CardTitle>
                    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      <span>{t("config")}</span>
                      <span>•</span>
                      <Badge variant="outline">v{result.version}</Badge>
                      <span>•</span>
                      <Calendar className="h-4 w-4" />
                      <span>{format(new Date(result.collected_at), "dd/MM/yyyy HH:mm")}</span>
                    </div>
                  </div>
                  <Badge>{result.matches} {t("occurrences")}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {result.snippets.length === 0 ? (
                    <div className="text-sm text-muted-foreground">{t("noSnippets")}</div>
                  ) : (
                    result.snippets.map((snippet, snippetIndex) => (
                      <div key={snippetIndex} className="p-3 rounded-lg bg-muted/50 border">
                        <div className="flex items-start gap-3">
                          <Badge variant="secondary" className="text-xs font-mono">
                            L{snippet.line}
                          </Badge>
                          <code className="flex-1 text-sm">
                            {highlightText(snippet.content, submittedTerm, submittedRegexMode)}
                          </code>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigate(`/devices/${result.device_id}`)}>
                    {t("viewDevice")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/devices/${result.device_id}/history`)}
                  >
                    {t("viewVersions")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default SearchConfigs;
