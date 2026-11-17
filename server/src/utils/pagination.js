/**
 * Pagination & Query Utility
 * --------------------------
 * Standardized pagination parser and response formatter across all list endpoints.
 */

const parsePagination = (query, defaultLimit = 10, maxLimit = 50) => {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);

  if (isNaN(page) || page < 1) {
    page = 1;
  }

  if (isNaN(limit) || limit < 1) {
    limit = defaultLimit;
  } else if (limit > maxLimit) {
    limit = maxLimit;
  }

  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

const formatPaginatedResponse = ({ data, totalItems, page, limit, extra = {} }) => {
  const totalPages = Math.ceil(totalItems / limit) || 1;

  return {
    success: true,
    data,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    // Top-level aliases for consistent access as requested in Task 1
    currentPage: page,
    totalPages,
    totalItems,
    limit,
    ...extra,
  };
};

/**
 * Escapes special regex characters in user search input to prevent Regex Injection
 */
const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

module.exports = {
  parsePagination,
  formatPaginatedResponse,
  escapeRegex,
};
