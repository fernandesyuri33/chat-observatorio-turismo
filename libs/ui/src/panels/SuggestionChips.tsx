type Props = {
  suggestions: string[];
  onSelect: (value: string) => void;
};

export function SuggestionChips({ suggestions, onSelect }: Props) {
  return (
    <div className="suggestion-chips">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          className="chip"
          onClick={() => onSelect(suggestion)}
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
