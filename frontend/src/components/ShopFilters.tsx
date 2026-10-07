/**
 * Shop Filters Component
 * Filtro lateral com categoria, subcategoria, marca, preço, etc.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import './ShopFilters.css';

export interface ShopFiltersProps {
  categories: string[];
  selectedCategory?: string;
  onCategoryChange: (category: string | undefined) => void;

  subcategories: string[];
  selectedSubcategory?: string;
  onSubcategoryChange: (subcategory: string | undefined) => void;

  brands: string[];
  selectedBrands: string[];
  onBrandChange: (brands: string[]) => void;

  priceRange: [number, number];
  onPriceChange: (range: [number, number]) => void;

  tags: string[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;

  sortBy: 'relevance' | 'price-asc' | 'price-desc' | 'rating' | 'newest';
  onSortChange: (sort: ShopFiltersProps['sortBy']) => void;

  totalProducts: number;
}

type FilterIconKind = 'sort' | 'category' | 'subcategory' | 'price' | 'brand' | 'features' | 'results';

function FilterIcon({ kind }: { kind: FilterIconKind }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'var(--red)',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  };

  switch (kind) {
    case 'category':
      return <svg {...common}><path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>;
    case 'subcategory':
      return <svg {...common}><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M8 12h8" /></svg>;
    case 'price':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M15 8.5c-.6-.6-1.4-1-2.5-1-1.4 0-2.5.8-2.5 2s1.1 1.8 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1.1 0-2-.4-2.6-1" /><path d="M12.5 6v12" /></svg>;
    case 'brand':
      return <svg {...common}><path d="M20 13 13 20 4 11V4h7z" /><circle cx="8" cy="8" r="1" /></svg>;
    case 'features':
      return <svg {...common}><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></svg>;
    case 'results':
      return <svg {...common}><path d="M4 19V5M4 19h17" /><path d="m7 15 4-4 3 2 5-6" /></svg>;
    default:
      return <svg {...common}><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="8" cy="6" r="2" fill="var(--surface)" /><circle cx="15" cy="12" r="2" fill="var(--surface)" /><circle cx="10" cy="18" r="2" fill="var(--surface)" /></svg>;
  }
}

export const ShopFilters: React.FC<ShopFiltersProps> = ({
  categories,
  selectedCategory,
  onCategoryChange,
  subcategories,
  selectedSubcategory,
  onSubcategoryChange,
  brands,
  selectedBrands,
  onBrandChange,
  priceRange,
  onPriceChange,
  tags,
  selectedTags,
  onTagsChange,
  sortBy,
  onSortChange,
  totalProducts,
}) => {
  const { t } = useTranslation();
  
  const toggleBrand = (brand: string) => {
    if (selectedBrands.includes(brand)) {
      onBrandChange(selectedBrands.filter(b => b !== brand));
    } else {
      onBrandChange([...selectedBrands, brand]);
    }
  };

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter(t => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  return (
    <aside className="shop-filters">
      <div className="filters-header">
        <h2>{t('shop.shopFilters.filterTitle')}</h2>
        <button
          className="btn-clear-filters"
          onClick={() => {
            onCategoryChange(undefined);
            onSubcategoryChange(undefined);
            onBrandChange([]);
            onPriceChange([0, 500]);
            onTagsChange([]);
            onSortChange('relevance');
          }}
        >
          {t('shop.shopFilters.clearFilters')}
        </button>
      </div>

      {/* ORDENAÇÃO */}
      <div className="filter-section">
        <h3 className="filter-heading"><FilterIcon kind="sort" />{t('shop.shopFilters.sortBy')}</h3>
        <select
          className="sort-select"
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as any)}
        >
          <option value="relevance">{t('shop.shopFilters.sortRelevance')}</option>
          <option value="price-asc">{t('shop.shopFilters.sortPriceAsc')}</option>
          <option value="price-desc">{t('shop.shopFilters.sortPriceDesc')}</option>
          <option value="rating">{t('shop.shopFilters.sortRating')}</option>
          <option value="newest">{t('shop.shopFilters.sortNewest')}</option>
        </select>
      </div>

      {/* CATEGORIAS */}
      <div className="filter-section">
        <h3 className="filter-heading"><FilterIcon kind="category" />{t('shop.shopFilters.categories')}</h3>
        <div className="filter-options">
          <label className={`filter-option ${!selectedCategory ? 'active' : ''}`}>
            <input
              type="radio"
              name="category"
              checked={!selectedCategory}
              onChange={() => onCategoryChange(undefined)}
            />
            <span>{t('shop.shopFilters.allCategories')}</span>
            <span className="count">({categories.length})</span>
          </label>
          {categories.map((cat) => (
            <label key={cat} className={`filter-option ${selectedCategory === cat ? 'active' : ''}`}>
              <input
                type="radio"
                name="category"
                checked={selectedCategory === cat}
                onChange={() => onCategoryChange(cat)}
              />
              <span>{cat}</span>
            </label>
          ))}
        </div>
      </div>

      {/* SUBCATEGORIAS (Aparecem se categoria selecionada) */}
      {selectedCategory && subcategories.length > 0 && (
        <div className="filter-section">
          <h3 className="filter-heading"><FilterIcon kind="subcategory" />{t('shop.shopFilters.subcategories')}</h3>
          <div className="filter-options">
            <label className={`filter-option ${!selectedSubcategory ? 'active' : ''}`}>
              <input
                type="radio"
                name="subcategory"
                checked={!selectedSubcategory}
                onChange={() => onSubcategoryChange(undefined)}
              />
              <span>{t('shop.shopFilters.allSubcategories')}</span>
            </label>
            {subcategories.map((subcat) => (
              <label key={subcat} className={`filter-option ${selectedSubcategory === subcat ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="subcategory"
                  checked={selectedSubcategory === subcat}
                  onChange={() => onSubcategoryChange(subcat)}
                />
                <span>{subcat}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* FAIXA DE PREÇO */}
      <div className="filter-section">
        <h3 className="filter-heading"><FilterIcon kind="price" />{t('shop.shopFilters.priceRange')}</h3>
        <div className="price-range">
          <label>
            {t('shop.shopFilters.minPrice')}
            <input
              type="number"
              min="0"
              value={priceRange[0]}
              onChange={(e) => onPriceChange([Number(e.target.value), priceRange[1]])}
              className="price-input"
            />
          </label>
          <label>
            {t('shop.shopFilters.maxPrice')}
            <input
              type="number"
              min="0"
              value={priceRange[1]}
              onChange={(e) => onPriceChange([priceRange[0], Number(e.target.value)])}
              className="price-input"
            />
          </label>
        </div>
        <input
          type="range"
          min="0"
          max="500"
          value={priceRange[1]}
          onChange={(e) => onPriceChange([priceRange[0], Number(e.target.value)])}
          className="price-slider"
        />
      </div>

      {/* MARCAS */}
      {brands.length > 0 && (
        <div className="filter-section">
          <h3 className="filter-heading"><FilterIcon kind="brand" />{t('shop.shopFilters.brands')}</h3>
          <div className="filter-options">
            {brands.slice(0, 8).map((brand) => (
              <label key={brand} className="filter-option">
                <input
                  type="checkbox"
                  checked={selectedBrands.includes(brand)}
                  onChange={() => toggleBrand(brand)}
                />
                <span>{brand}</span>
              </label>
            ))}
            {brands.length > 8 && (
              <details className="more-brands">
                <summary>{t('shop.shopFilters.viewMoreBrands', { count: brands.length - 8 })}</summary>
                <div className="filter-options">
                  {brands.slice(8).map((brand) => (
                    <label key={brand} className="filter-option">
                      <input
                        type="checkbox"
                        checked={selectedBrands.includes(brand)}
                        onChange={() => toggleBrand(brand)}
                      />
                      <span>{brand}</span>
                    </label>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
      )}

      {/* TAGS */}
      {tags.length > 0 && (
        <div className="filter-section">
          <h3 className="filter-heading"><FilterIcon kind="features" />{t('shop.shopFilters.characteristics')}</h3>
          <div className="filter-tags">
            {tags.slice(0, 10).map((tag) => (
              <button
                key={tag}
                className={`filter-tag ${selectedTags.includes(tag) ? 'active' : ''}`}
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* RESUMO DE RESULTADOS */}
      <div className="filter-summary">
        <p className="filter-summary-row"><FilterIcon kind="results" />{t('shop.shopFilters.filterSummary', { count: totalProducts })}</p>
        {selectedCategory && <p className="filter-summary-row"><FilterIcon kind="category" />{t('shop.shopFilters.filterSummaryCategory', { category: selectedCategory })}</p>}
        {selectedSubcategory && <p className="filter-summary-row"><FilterIcon kind="subcategory" />{t('shop.shopFilters.filterSummarySubcategory', { subcategory: selectedSubcategory })}</p>}
        {selectedBrands.length > 0 && <p className="filter-summary-row"><FilterIcon kind="brand" />{t('shop.shopFilters.filterSummaryBrands', { count: selectedBrands.length })}</p>}
      </div>
    </aside>
  );
};

export default ShopFilters;
