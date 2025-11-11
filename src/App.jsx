import React, { useState, useEffect, useMemo, useRef } from 'react';
import localforage from 'https://cdn.skypack.dev/localforage';
import {
  Trash2,
  Plus,
  Shuffle,
  Package,
  Clapperboard,
  Check,
  ImageOff,
  Link,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

// --- Configuração do localForage ---
localforage.config({
  name: 'virtualWardrobe',
  storeName: 'wardrobe_data',
  description: 'My local wardrobe items and outfits',
});

// --- Helper Components ---

const ImageWithFallback = ({ src, alt, className = '' }) => {
  const [error, setError] = useState(false);
  const [isInvalidSrc, setIsInvalidSrc] = useState(false);

  useEffect(() => {
    setIsInvalidSrc(!src || (typeof src === 'string' && src.length < 100));
    setError(false);
  }, [src]);

  const handleError = () => {
    setError(true);
  };

  const placeholder = (
    <div
      className={`flex items-center justify-center bg-gray-200 text-gray-500 rounded-lg w-full h-[240px] ${className}`}
    >
      <ImageOff size={24} />
    </div>
  );

  return error || isInvalidSrc ? (
    placeholder
  ) : (
    <img
      src={src}
      alt={alt}
      className={`w-full h-[240px] object-contain ${className}`}
      onError={handleError}
    />
  );
};

const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
};

const resizeImage = (base64Str, maxHeight = 500) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      if (img.height <= maxHeight) {
        resolve(base64Str);
        return;
      }

      const scaleRatio = maxHeight / img.height;
      const newWidth = img.width * scaleRatio;
      const newHeight = img.height * scaleRatio;

      const canvas = document.createElement('canvas');
      canvas.width = newWidth;
      canvas.height = newHeight;
      const ctx = canvas.getContext('2d');

      ctx.drawImage(img, 0, 0, newWidth, newHeight);
      const resizedBase64 = canvas.toDataURL('image/jpeg', 0.8);
      resolve(resizedBase64);
    };
  });
};

// MUDANÇA: Componente de cartão reutilizável
// Este é o estilo exato do 'renderOutfitsView'
const ItemCard = ({
  item,
  onClick,
  isSelected,
  showDeleteButton,
  onDelete,
}) => {
  const shouldShowDelete =
    !onClick &&
    (typeof showDeleteButton === 'boolean'
      ? showDeleteButton
      : Boolean(onDelete));

  const handleDeleteClick = (event) => {
    event.stopPropagation();
    event.preventDefault();
    if (onDelete) {
      onDelete();
    }
  };

  const baseClasses =
    'relative w-[180px] flex-shrink-0 group rounded overflow-hidden shadow-sm border-2 transition-all';
  const clickableClasses = isSelected
    ? 'border-blue-500'
    : 'border-transparent hover:border-blue-500';

  const cardContent = (
    <>
      <ImageWithFallback
        src={item.imageUrl}
        alt={item.name}
        className="rounded-t"
      />
      <div className="p-2 bg-white">
        <p className="font-medium text-sm text-gray-800 truncate">
          {item.name}
        </p>
      </div>
      {isSelected && (
        <div className="absolute inset-0 bg-blue-500 bg-opacity-50 flex items-center justify-center">
          <Check size={24} className="text-white" />
        </div>
      )}
      {shouldShowDelete && (
        <button
          type="button"
          onClick={handleDeleteClick}
          className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
          aria-label="Delete item"
        >
          <Trash2 size={16} />
        </button>
      )}
    </>
  );

  // Se 'onClick' for fornecido, o cartão usa um <button>
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${baseClasses} ${clickableClasses} cursor-pointer`}
      >
        {cardContent}
      </button>
    );
  }

  // Caso contrário, é um <div> (para o Wardrobe ou sugestões)
  return (
    <div className={`${baseClasses} border-transparent`}>
      {cardContent}
    </div>
  );
};

export default function App() {
  const [currentView, setCurrentView] = useState('wardrobe');
  const [items, setItems] = useState([]);
  const [outfits, setOutfits] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newItemName, setNewItemName] = useState('');
  const [newItemFile, setNewItemFile] = useState(null);
  const [newItemCategory, setNewItemCategory] = useState('Top');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [newOutfitName, setNewOutfitName] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState([]);

  const [generatedOutfit, setGeneratedOutfit] = useState(null);
  const [generatorError, setGeneratorError] = useState(null);

  const [selectedTopId, setSelectedTopId] = useState(null);
  const [selectedBottomId, setSelectedBottomId] = useState(null);
  const [openPairingCategory, setOpenPairingCategory] = useState(null);

  const ITEM_CATEGORIES = [
    'Top',
    'Bottom',
    'Outerwear',
    'Accessory',
  ];

  const [openCategories, setOpenCategories] = useState([]);
  const [openOutfitIds, setOpenOutfitIds] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const storedItems = (await localforage.getItem('wardrobeItems')) || [];
        const storedOutfits =
          (await localforage.getItem('wardrobeOutfits')) || [];

        setItems(storedItems);
        setOutfits(storedOutfits);
      } catch (error) {
        console.error('Error loading data from localForage:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleAddItem = async () => {
    if (!newItemName.trim() || !newItemFile) return;
    setIsUploading(true);
    try {
      const originalBase64 = await fileToBase64(newItemFile);
      const resizedImageUrl = await resizeImage(originalBase64, 550);
      const newItem = {
        id: `item_${Date.now()}`,
        name: newItemName,
        imageUrl: resizedImageUrl,
        category: newItemCategory,
      };

      const newItemsList = [...items, newItem];
      setItems(newItemsList);
      await localforage.setItem('wardrobeItems', newItemsList);

      setNewItemName('');
      setNewItemFile(null);
      setNewItemCategory('Top');
      if (fileInputRef.current) {
        fileInputRef.current.value = null;
      }
    } catch (error) {
      console.error('Error adding item:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteItem = async (itemId) => {
    try {
      const newItemsList = items.filter((item) => item.id !== itemId);
      setItems(newItemsList);
      await localforage.setItem('wardrobeItems', newItemsList);
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const toggleItemSelection = (itemId) => {
    setSelectedItemIds((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSaveOutfit = async () => {
    if (!newOutfitName.trim() || selectedItemIds.length === 0) return;
    const newOutfit = {
      id: `outfit_${Date.now()}`,
      name: newOutfitName,
      itemIds: selectedItemIds,
    };
    try {
      const newOutfitsList = [...outfits, newOutfit];
      setOutfits(newOutfitsList);
      await localforage.setItem('wardrobeOutfits', newOutfitsList);
      setNewOutfitName('');
      setSelectedItemIds([]);
    } catch (error) {
      console.error('Error saving outfit:', error);
    }
  };

  const handleDeleteOutfit = async (outfitId) => {
    try {
      const newOutfitsList = outfits.filter(
        (outfit) => outfit.id !== outfitId
      );
      setOutfits(newOutfitsList);
      await localforage.setItem('wardrobeOutfits', newOutfitsList);
    } catch (error) {
      console.error('Error deleting outfit:', error);
    }
  };

  const handleGenerateOutfit = () => {
    setGeneratorError(null);
    setGeneratedOutfit(null);
    const tops = items.filter((i) => i.category === 'Top');
    const bottoms = items.filter((i) => i.category === 'Bottom');
    const outerwearOptions = items.filter((i) => i.category === 'Outerwear');
    if (tops.length === 0 || bottoms.length === 0) {
      setGeneratorError(
        "Please add at least one 'Top' and one 'Bottom' to use the generator."
      );
      return;
    }
    const randomTop = tops[Math.floor(Math.random() * tops.length)];
    const randomBottom = bottoms[Math.floor(Math.random() * bottoms.length)];
    const randomOuterwear =
      outerwearOptions.length > 0
        ? outerwearOptions[
            Math.floor(Math.random() * outerwearOptions.length)
          ]
        : null;

    const generated = {
      top: randomTop,
      bottom: randomBottom,
    };

    if (randomOuterwear) {
      generated.outerwear = randomOuterwear;
    }

    setGeneratedOutfit(generated);
  };

  const handleSelectTop = (id) => {
    setSelectedTopId(id);
    setSelectedBottomId(null);
    setOpenPairingCategory(null);
  };

  const handleSelectBottom = (id) => {
    setSelectedBottomId(id);
    setSelectedTopId(null);
    setOpenPairingCategory(null);
  };

  const handleToggleCategory = (categoryName) => {
    setOpenCategories((prev) =>
      prev.includes(categoryName)
        ? prev.filter((cat) => cat !== categoryName)
        : [...prev, categoryName]
    );
  };

  const handleToggleOutfit = (outfitId) => {
    setOpenOutfitIds((prev) =>
      prev.includes(outfitId) ? [] : [outfitId]
    );
  };
  const handleTogglePairingCategory = (categoryToOpen) => {
    if (openPairingCategory === categoryToOpen) {
      setOpenPairingCategory(null);
      return;
    }

    setOpenPairingCategory(categoryToOpen);
    if (categoryToOpen === 'tops') {
      setSelectedBottomId(null);
    }
    if (categoryToOpen === 'bottoms') {
      setSelectedTopId(null);
    }
  };

  const clearPairingSelection = () => {
    setSelectedTopId(null);
    setSelectedBottomId(null);
    setOpenPairingCategory(null);
  };

  const changeView = (view) => {
    setCurrentView(view);
    clearPairingSelection();
  };

  const itemsByCategory = useMemo(() => {
    return items.reduce((acc, item) => {
      (acc[item.category] = acc[item.category] || []).push(item);
      return acc;
    }, {});
  }, [items]);

  const outfitsWithItems = useMemo(() => {
    return outfits
      .map((outfit) => ({
        ...outfit,
        items: outfit.itemIds
          .map((id) => items.find((item) => item.id === id))
          .filter(Boolean),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [outfits, items]);

  const tops = useMemo(() => items.filter((i) => i.category === 'Top'), [items]);
  const bottoms = useMemo(
    () => items.filter((i) => i.category === 'Bottom'),
    [items]
  );
  const outerwear = useMemo(
    () => items.filter((i) => i.category === 'Outerwear'),
    [items]
  );

  const selectedPairingItemId = selectedTopId || selectedBottomId;

  const smartSuggestions = useMemo(() => {
    if (!selectedPairingItemId) {
      return { tops: [], bottoms: [], outerwear: [] };
    }

    const relevantOutfits = outfitsWithItems.filter((outfit) =>
      outfit.itemIds.includes(selectedPairingItemId)
    );

    const collectByCategory = (category) => {
      const unique = new Map();
      relevantOutfits.forEach((outfit) => {
        outfit.items.forEach((item) => {
          if (item.id === selectedPairingItemId) return;
          if (item.category !== category) return;
          if (!unique.has(item.id)) {
            unique.set(item.id, item);
          }
        });
      });
      return Array.from(unique.values());
    };

    return {
      tops: collectByCategory('Top'),
      bottoms: collectByCategory('Bottom'),
      outerwear: collectByCategory('Outerwear'),
    };
  }, [selectedPairingItemId, outfitsWithItems]);

  const renderLoading = () => (
    <div className="flex justify-center items-center h-64">
      <p className="text-gray-500">Loading your wardrobe...</p>
    </div>
  );

  const renderWardrobeView = () => (
    <div>
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-2xl font-semibold mb-4 text-gray-800">
          Add New Item
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="Item Name (e.g., 'Red T-Shirt')"
            className="p-3 border border-gray-300 rounded-lg w-full"
            required
          />
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={(e) => setNewItemFile(e.target.files[0])}
            className="p-3 border border-gray-300 rounded-lg w-full file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            required
          />
          <div className="flex gap-4">
            <select
              value={newItemCategory}
              onChange={(e) => setNewItemCategory(e.target.value)}
              className="p-3 border border-gray-300 rounded-lg w-full"
            >
              {ITEM_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddItem}
              disabled={isUploading}
              className="flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400"
            >
              <Plus size={18} /> {isUploading ? 'Resizing...' : 'Add'}
            </button>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-semibold mb-4 text-gray-800">My Wardrobe</h2>
      {loading ? (
        renderLoading()
      ) : (
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {items.length === 0 && (
            <p className="text-gray-500 text-center p-8">
              Your wardrobe is empty. Add some items above!
            </p>
          )}
          {Object.entries(itemsByCategory)
            .sort(
              ([catA], [catB]) =>
                ITEM_CATEGORIES.indexOf(catA) - ITEM_CATEGORIES.indexOf(catB)
            )
            .map(([category, catItems]) => {
              const isOpen = openCategories.includes(category);
              return (
                <div key={category}>
                  <button
                    onClick={() => handleToggleCategory(category)}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <h4 className="text-lg font-semibold mb-2 text-gray-600 hover:text-blue-600">
                      {category} ({catItems.length})
                    </h4>
                    {isOpen ? (
                      <ChevronDown size={18} className="text-gray-500 mb-2" />
                    ) : (
                      <ChevronRight size={18} className="text-gray-500 mb-2" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="flex flex-row gap-4 overflow-x-auto pb-4">
                      {catItems.map((item) => (
                        <ItemCard
                          key={item.id}
                          item={item}
                          showDeleteButton
                          onClick={() => toggleItemSelection(item.id)}
                          onDelete={() => handleDeleteItem(item.id)}
                          
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );

  const ItemGrid = ({
    items,
    onSelectItem = () => {},
    title,
    isSelectable = true,
    emptyMessage,
    onItemClick,
    selectedIds = [],
  }) => {
    const resolvedEmptyMessage =
      emptyMessage ??
      "No items found in this category. Add some in the 'Wardrobe' tab!";

    if (items.length === 0) {
      return (
        <div>
          {title && (
            <h3 className="text-xl font-semibold mb-3 text-gray-700">
              {title}
            </h3>
          )}
          <p className="text-gray-500">{resolvedEmptyMessage}</p>
        </div>
      );
    }

    return (
      <div>
        {title && (
          <h3 className="text-xl font-semibold mb-3 text-gray-700">
            {title}
          </h3>
        )}
        <div className="flex flex-row gap-4 overflow-x-auto pb-4">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onClick={
                onItemClick
                  ? () => onItemClick(item.id)
                  : isSelectable
                  ? () => onSelectItem(item.id)
                  : null
              }
              isSelected={selectedIds.includes(item.id)}
            />
          ))}
        </div>
      </div>
    );
  };

  const SelectedItemDisplay = ({ itemId, items, onClear, title }) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return null;

    return (
      <div className="mb-6 p-4 bg-white rounded-lg shadow">
        <h3 className="text-xl font-semibold mb-3 text-gray-700">{title}</h3>
        <div className="flex gap-4 items-center">
          <div className="w-[180px] h-[240px] rounded-lg overflow-hidden border flex-shrink-0">
            <ImageWithFallback
              src={item.imageUrl}
              alt={item.name}
              className="h-full rounded-lg"
            />
          </div>
          <div>
            <p className="font-semibold text-lg text-gray-800">{item.name}</p>
            <p className="text-sm text-gray-500 mb-2">{item.category}</p>
            <button
              onClick={onClear}
              className="text-sm text-blue-600 hover:underline"
            >
              Clear Selection
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderOutfitsView = () => (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4 text-gray-800">
          Create New Outfit
        </h2>
        <div className="space-y-6">
          <div className="flex gap-4">
            <input
              type="text"
              value={newOutfitName}
              onChange={(e) => setNewOutfitName(e.target.value)}
              placeholder="Outfit Name (e.g., 'Beach Day')"
              className="p-3 border border-gray-300 rounded-lg w-full"
              required
            />
            <button
              type="button"
              onClick={handleSaveOutfit}
              disabled={selectedItemIds.length === 0}
              className="flex items-center justify-center gap-2 bg-green-600 text-white px-5 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:bg-gray-400"
            >
              <Plus size={18} /> Save Outfit
            </button>
          </div>

          <h3 className="text-xl font-semibold text-gray-700">Select Items:</h3>
          {items.length === 0 && (
            <p className="text-gray-500 text-center p-8">
              You need to add items to your 'Wardrobe' first!
            </p>
          )}
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            {Object.entries(itemsByCategory)
              .sort(
                ([catA], [catB]) =>
                  ITEM_CATEGORIES.indexOf(catA) - ITEM_CATEGORIES.indexOf(catB)
              )
              .map(([category, catItems]) => {
                const isOpen = openCategories.includes(category);
                return (
                  <div key={category}>
                    <button
                      onClick={() => handleToggleCategory(category)}
                      className="flex items-center justify-between w-full text-left"
                    >
                      <h4 className="text-lg font-semibold mb-2 text-gray-600 hover:text-blue-600">
                        {category} ({catItems.length})
                      </h4>
                      {isOpen ? (
                        <ChevronDown size={18} className="text-gray-500 mb-2" />
                      ) : (
                        <ChevronRight size={18} className="text-gray-500 mb-2" />
                      )}
                    </button>

                    {isOpen && (
                      <div className="flex flex-row gap-4 overflow-x-auto pb-4">
                        {catItems.map((item) => (
                          // MUDANÇA: Usar o novo componente ItemCard
                          <ItemCard
                            key={item.id}
                            item={item}
                            onClick={() => toggleItemSelection(item.id)}
                            isSelected={selectedItemIds.includes(item.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4 text-gray-800">
          My Outfits
        </h2>
        <div className="flex flex-row gap-4 overflow-x-auto pb-4">
          {outfits.length === 0 && (
            <p className="text-gray-500 text-center p-8 w-full">
              You haven't saved any outfits yet.
            </p>
          )}
          {outfitsWithItems.map((outfit) => {
            const isOpen = openOutfitIds.includes(outfit.id);
            return (
              <div
                key={outfit.id}
                className="border border-gray-200 rounded-lg p-4 w-[360px] flex-shrink-0"
              >
                <div className="flex justify-between items-center">
                  <button
                    onClick={() => handleToggleOutfit(outfit.id)}
                    className="flex items-center gap-2 text-left"
                  >
                    {isOpen ? (
                      <ChevronDown size={18} className="text-gray-600" />
                    ) : (
                      <ChevronRight size={18} className="text-gray-600" />
                    )}
                    <h3 className="text-lg font-semibold text-gray-800">
                      {outfit.name}
                    </h3>
                  </button>
                  <button
                    onClick={() => handleDeleteOutfit(outfit.id)}
                    className="text-red-600 hover:text-red-700 p-1"
                    aria-label="Delete outfit"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                {isOpen && (
                  <div className="flex flex-row gap-4 overflow-x-auto pb-4 mt-3">
                    {outfit.items.length === 0 && (
                      <p className="text-sm text-gray-500">
                        Items for this outfit were deleted.
                      </p>
                    )}
                    {outfit.items.map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        onClick={() => toggleItemSelection(item.id)}
                        isSelected={selectedItemIds.includes(item.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderPairingsView = () => (
    <div className="space-y-8">
      <section className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-2 text-gray-800">
          Find Pairings
        </h2>
        <p className="text-gray-600 mb-6">
          Select one item (Top or Bottom) to see suggestions from your saved
          outfits.
        </p>

        <div className="space-y-4">
          <div>
            <button
              onClick={() => handleTogglePairingCategory('tops')}
              className="flex items-center justify-between w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-lg"
            >
              <h3 className="text-xl font-semibold text-gray-700">
                Select a Top
              </h3>
              {openPairingCategory === 'tops' ? (
                <ChevronDown size={20} className="text-gray-600" />
              ) : (
                <ChevronRight size={20} className="text-gray-600" />
              )}
            </button>
            {openPairingCategory === 'tops' && (
              <div className="mt-4">
                <ItemGrid
                  items={tops}
                  onSelectItem={handleSelectTop}
                  isSelectable={true}
                />
              </div>
            )}
          </div>

          <div>
            <button
              onClick={() => handleTogglePairingCategory('bottoms')}
              className="flex items-center justify-between w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-lg"
            >
              <h3 className="text-xl font-semibold text-gray-700">
                Select a Bottom
              </h3>
              {openPairingCategory === 'bottoms' ? (
                <ChevronDown size={20} className="text-gray-600" />
              ) : (
                <ChevronRight size={20} className="text-gray-600" />
              )}
            </button>
            {openPairingCategory === 'bottoms' && (
              <div className="mt-4">
                <ItemGrid
                  items={bottoms}
                  onSelectItem={handleSelectBottom}
                  isSelectable={true}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {(selectedTopId || selectedBottomId) && (
        <section className="space-y-6">
          <SelectedItemDisplay
            itemId={selectedTopId || selectedBottomId}
            items={items}
            onClear={clearPairingSelection}
            title="You selected:"
          />

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800">
              Suggestions (from your saved outfits)
            </h2>
            <div className="space-y-6">
              {selectedTopId && (
                <>
                  <ItemGrid
                    items={smartSuggestions.bottoms}
                    title="Suggested Bottoms:"
                    isSelectable={false}
                    onItemClick={toggleItemSelection}
                    selectedIds={selectedItemIds}
                    emptyMessage="No saved pairings found for this item."
                  />
                  <ItemGrid
                    items={smartSuggestions.outerwear}
                    title="Suggested Outerwear:"
                    isSelectable={false}
                    onItemClick={toggleItemSelection}
                    selectedIds={selectedItemIds}
                    emptyMessage="No saved pairings found for this item."
                  />
                </>
              )}

              {selectedBottomId && (
                <>
                  <ItemGrid
                    items={smartSuggestions.tops}
                    title="Suggested Tops:"
                    isSelectable={false}
                    onItemClick={toggleItemSelection}
                    selectedIds={selectedItemIds}
                    emptyMessage="No saved pairings found for this item."
                  />
                  <ItemGrid
                    items={smartSuggestions.outerwear}
                    title="Suggested Outerwear:"
                    isSelectable={false}
                    onItemClick={toggleItemSelection}
                    selectedIds={selectedItemIds}
                    emptyMessage="No saved pairings found for this item."
                  />
                </>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );

  const renderGeneratorView = () => (
    <div className="text-center max-w-2xl mx-auto">
      <h2 className="text-2xl font-semibold mb-6 text-gray-800">
        Outfit Generator
      </h2>
      <button
        onClick={handleGenerateOutfit}
        className="flex items-center justify-center gap-2 bg-purple-600 text-white px-8 py-4 rounded-lg font-medium text-lg hover:bg-purple-700 transition-colors shadow-lg mx-auto"
      >
        <Shuffle size={20} /> Generate My Outfit
      </button>

      {generatorError && (
        <div
          className="mt-6 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-lg text-left"
          role="alert"
        >
          <p className="font-bold">Heads up!</p>
          <p>{generatorError}</p>
        </div>
      )}

      {generatedOutfit && (
        <div className="mt-10">
          <h3 className="text-2xl font-semibold mb-6 text-gray-700">
            Here's your outfit!
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {Object.entries(generatedOutfit).map(([category, item]) => (
              // MUDANÇA: Usar o novo componente ItemCard
              // O `ItemCard` não tem 'category', por isso fazemos este wrapper
              <div key={category}>
                <ItemCard
                  item={item}
                  onClick={() => toggleItemSelection(item.id)}
                  isSelected={selectedItemIds.includes(item.id)}
                />
                <p className="font-semibold text-sm uppercase text-gray-500 mt-2">
                  {category}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p className="text-gray-600">Initializing your wardrobe...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 font-inter p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">
            My Virtual Wardrobe
          </h1>
          <nav className="flex flex-wrap justify-center md:justify-end gap-2 mt-4 md:mt-0">
            {[
              { id: 'wardrobe', label: 'Wardrobe', icon: Package },
              { id: 'outfits', label: 'Outfits', icon: Clapperboard },
              { id: 'pairings', label: 'Find Pairings', icon: Link },
              { id: 'generate', label: 'Generator', icon: Shuffle },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = currentView === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => changeView(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </header>

        <main>
          {currentView === 'wardrobe' && renderWardrobeView()}
          {currentView === 'outfits' && renderOutfitsView()}
          {currentView === 'pairings' && renderPairingsView()}
          {currentView === 'generate' && renderGeneratorView()}
        </main>

        <footer className="mt-12 text-center text-gray-500 text-xs">
          <p>App a correr 100% localmente.</p>
        </footer>
      </div>
    </div>
  );
}