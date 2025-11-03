
import { Database } from 'arangojs';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface GeoOptions {
  limit?: number;
  filter?: Record<string, any>;
  returnDistance?: boolean;
}

export class GeoQuery {
  private database: Database;

  constructor(database: Database) {
    this.database = database;
  }

  /**
   * Find documents within a radius (near a point)
   */
  async near(
    collectionName: string,
    point: GeoPoint,
    radiusMeters: number,
    options: GeoOptions = {}
  ): Promise<any[]> {
    const {
      limit = 10,
      filter = {},
      returnDistance = true,
    } = options;

    const bindVars: Record<string, any> = {
      latitude: point.latitude,
      longitude: point.longitude,
      radius: radiusMeters,
      limit,
    };

    let query = `
      FOR doc IN @@collection
      FILTER DISTANCE(doc.@latField, doc.@lonField, @latitude, @longitude) <= @radius
    `;

    // Add additional filters
    if (Object.keys(filter).length > 0) {
      const filterParts: string[] = [];
      let varCounter = 0;
      for (const [key, value] of Object.entries(filter)) {
        const varName = `filter${varCounter++}`;
        bindVars[varName] = value;
        filterParts.push(`doc.${key} == @${varName}`);
      }
      query += `\n      FILTER ${filterParts.join(' AND ')}`;
    }

    if (returnDistance) {
      query += `
        LET distance = DISTANCE(doc.@latField, doc.@lonField, @latitude, @longitude)
        SORT distance ASC
        LIMIT @limit
        RETURN MERGE(doc, { _distance: distance })
      `;
    } else {
      query += `
        SORT DISTANCE(doc.@latField, doc.@lonField, @latitude, @longitude) ASC
        LIMIT @limit
        RETURN doc
      `;
    }

    bindVars['@collection'] = collectionName;
    bindVars['@latField'] = 'latitude';
    bindVars['@lonField'] = 'longitude';

    try {
      const cursor = await this.database.query(query, bindVars);
      return await cursor.all();
    } catch (error: any) {
      throw new Error(`Geo near query failed: ${error.message}`);
    }
  }

  /**
   * Find documents within a bounding box
   */
  async withinBounds(
    collectionName: string,
    topLeft: GeoPoint,
    bottomRight: GeoPoint,
    options: GeoOptions = {}
  ): Promise<any[]> {
    const {
      limit = 100,
      filter = {},
    } = options;

    const bindVars: Record<string, any> = {
      minLat: Math.min(topLeft.latitude, bottomRight.latitude),
      maxLat: Math.max(topLeft.latitude, bottomRight.latitude),
      minLon: Math.min(topLeft.longitude, bottomRight.longitude),
      maxLon: Math.max(topLeft.longitude, bottomRight.longitude),
      limit,
    };

    let query = `
      FOR doc IN @@collection
      FILTER doc.@latField >= @minLat 
        AND doc.@latField <= @maxLat
        AND doc.@lonField >= @minLon
        AND doc.@lonField <= @maxLon
    `;

    // Add additional filters
    if (Object.keys(filter).length > 0) {
      const filterParts: string[] = [];
      let varCounter = 0;
      for (const [key, value] of Object.entries(filter)) {
        const varName = `filter${varCounter++}`;
        bindVars[varName] = value;
        filterParts.push(`doc.${key} == @${varName}`);
      }
      query += `\n      FILTER ${filterParts.join(' AND ')}`;
    }

    query += `
      LIMIT @limit
      RETURN doc
    `;

    bindVars['@collection'] = collectionName;
    bindVars['@latField'] = 'latitude';
    bindVars['@lonField'] = 'longitude';

    try {
      const cursor = await this.database.query(query, bindVars);
      return await cursor.all();
    } catch (error: any) {
      throw new Error(`Geo within bounds query failed: ${error.message}`);
    }
  }

  /**
   * Find documents within a polygon
   */
  async withinPolygon(
    collectionName: string,
    polygon: GeoPoint[],
    options: GeoOptions = {}
  ): Promise<any[]> {
    const {
      limit = 100,
      filter = {},
    } = options;

    // Convert polygon to AQL format
    const polygonArray = polygon.map((p) => [p.latitude, p.longitude]);
    // Close the polygon if not already closed
    if (polygonArray[0][0] !== polygonArray[polygonArray.length - 1][0] ||
        polygonArray[0][1] !== polygonArray[polygonArray.length - 1][1]) {
      polygonArray.push([polygonArray[0][0], polygonArray[0][1]]);
    }

    const bindVars: Record<string, any> = {
      polygon: polygonArray,
      limit,
    };

    let query = `
      FOR doc IN @@collection
      FILTER GEO_CONTAINS(
        GEO_POLYGON(@polygon),
        GEO_POINT(doc.@latField, doc.@lonField)
      )
    `;

    // Add additional filters
    if (Object.keys(filter).length > 0) {
      const filterParts: string[] = [];
      let varCounter = 0;
      for (const [key, value] of Object.entries(filter)) {
        const varName = `filter${varCounter++}`;
        bindVars[varName] = value;
        filterParts.push(`doc.${key} == @${varName}`);
      }
      query += `\n      FILTER ${filterParts.join(' AND ')}`;
    }

    query += `
      LIMIT @limit
      RETURN doc
    `;

    bindVars['@collection'] = collectionName;
    bindVars['@latField'] = 'latitude';
    bindVars['@lonField'] = 'longitude';

    try {
      const cursor = await this.database.query(query, bindVars);
      return await cursor.all();
    } catch (error: any) {
      throw new Error(`Geo within polygon query failed: ${error.message}`);
    }
  }

  /**
   * Calculate distance between two points
   */
  static distance(point1: GeoPoint, point2: GeoPoint): number {
    // Haversine formula
    const R = 6371000; // Earth radius in meters
    const lat1Rad = (point1.latitude * Math.PI) / 180;
    const lat2Rad = (point2.latitude * Math.PI) / 180;
    const deltaLat = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const deltaLon = ((point2.longitude - point1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1Rad) *
        Math.cos(lat2Rad) *
        Math.sin(deltaLon / 2) *
        Math.sin(deltaLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

