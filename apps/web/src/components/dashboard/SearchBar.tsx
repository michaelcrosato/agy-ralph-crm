import type { SearchResult } from "../../types/crm";

interface SearchBarProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchResults: SearchResult[];
  showSearchResults: boolean;
  onShowSearchResults: (show: boolean) => void;
}

/**
 * Fuzzy search input bar with real-time results dropdown overlay.
 * Renders inside the navbar panel header area.
 */
export function SearchBar({
  searchQuery,
  onSearchQueryChange,
  searchResults,
  showSearchResults,
  onShowSearchResults,
}: SearchBarProps) {
  return (
    <div style={{ position: "relative", width: "280px" }}>
      <input
        type="text"
        aria-label="Search records"
        placeholder="Fuzzy search Leads, Contacts..."
        className="glass-input"
        value={searchQuery}
        onChange={(e) => onSearchQueryChange(e.target.value)}
        onFocus={() => searchQuery && onShowSearchResults(true)}
        style={{ paddingRight: searchQuery ? "2rem" : undefined }}
      />
      {searchQuery && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onSearchQueryChange("")}
          style={{
            position: "absolute",
            right: "0.5rem",
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            color: "var(--text-secondary)",
            cursor: "pointer",
            padding: "0.25rem",
          }}
        >
          ✕
        </button>
      )}
      {showSearchResults &&
        searchQuery &&
        (searchResults.length > 0 ? (
          <div
            className="glass-panel"
            style={{
              position: "absolute",
              top: "105%",
              left: 0,
              right: 0,
              zIndex: 100,
              padding: "0.5rem",
              background: "rgba(15, 23, 42, 0.95)",
            }}
          >
            <div
              className="text-xs mb-2"
              style={{
                color: "var(--text-muted)",
                borderBottom: "1px solid var(--glass-border)",
                paddingBottom: "4px",
              }}
            >
              Fuzzy Search Results
            </div>
            {searchResults.map((result) => (
              <button
                type="button"
                key={result.id}
                className="p-2 flex items-center justify-between hover:bg-white/5 rounded cursor-pointer w-full text-left"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.5rem",
                  borderRadius: "8px",
                  background: "none",
                  border: "none",
                  color: "inherit",
                  font: "inherit",
                  cursor: "pointer",
                  textAlign: "left",
                }}
                onClick={() => {
                  onSearchQueryChange(result.title);
                  onShowSearchResults(false);
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                    {result.title}
                  </div>
                  <div
                    style={{
                      color: "var(--text-secondary)",
                      fontSize: "0.75rem",
                    }}
                  >
                    {result.subtitle}
                  </div>
                </div>
                <span
                  className={`badge ${
                    result.type === "Lead"
                      ? "badge-lead"
                      : result.type === "Contact"
                        ? "badge-contact"
                        : result.type === "Opportunity"
                          ? "badge-opp"
                          : "badge-account"
                  }`}
                >
                  {result.type}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div
            className="glass-panel"
            style={{
              position: "absolute",
              top: "105%",
              left: 0,
              right: 0,
              zIndex: 100,
              padding: "1rem",
              background: "rgba(15, 23, 42, 0.95)",
              textAlign: "center",
              color: "var(--text-secondary)",
              fontSize: "0.85rem",
            }}
          >
            No results found for &quot;{searchQuery}&quot;
          </div>
        ))}
    </div>
  );
}
