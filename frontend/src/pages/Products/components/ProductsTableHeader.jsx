import React from 'react';
import SortableHeader from '../../../components/SortableHeader';

const ProductsTableHeader = ({ sortBy, sortDir, onSort, showPointsColumn }) => (
  <tr>
    <SortableHeader
      label="Código"
      field="code"
      sortBy={sortBy}
      sortDir={sortDir}
      onSort={onSort}
      width="w-[6%]"
      testIdPrefix="products"
    />
    <th
      scope="col"
      className="w-[4%] px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
    >
      Site
    </th>
    <SortableHeader
      label="Produto"
      field="name"
      sortBy={sortBy}
      sortDir={sortDir}
      onSort={onSort}
      width="w-[22%]"
      testIdPrefix="products"
    />
    <SortableHeader
      label="Tamanho"
      field="size"
      sortBy={sortBy}
      sortDir={sortDir}
      onSort={onSort}
      width="w-[8%]"
      testIdPrefix="products"
    />
    <SortableHeader
      label="Preço Regular"
      field="regularPrice"
      sortBy={sortBy}
      sortDir={sortDir}
      onSort={onSort}
      width="w-[9%]"
      align="right"
      testIdPrefix="products"
    />
    <SortableHeader
      label="Preço Membro"
      field="memberPrice"
      sortBy={sortBy}
      sortDir={sortDir}
      onSort={onSort}
      width="w-[9%]"
      align="right"
      testIdPrefix="products"
    />
    <SortableHeader
      label="PV"
      field="pv"
      sortBy={sortBy}
      sortDir={sortDir}
      onSort={onSort}
      width="w-[5%]"
      align="right"
      testIdPrefix="products"
    />
    <SortableHeader
      label="R$/PV"
      field="pricePerPv"
      sortBy={sortBy}
      sortDir={sortDir}
      onSort={onSort}
      width="w-[7%]"
      align="right"
      testIdPrefix="products"
    />
    {showPointsColumn && (
      <th
        scope="col"
        className="w-[8%] px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
      >
        Pontos
      </th>
    )}
    <th
      scope="col"
      className="w-[12%] px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
    >
      Status
    </th>
    <th
      scope="col"
      className="w-[10%] px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
    >
      Ações
    </th>
  </tr>
);

export default ProductsTableHeader;
