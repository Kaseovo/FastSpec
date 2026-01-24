<template>
  <div>
    <div v-if="inline" class="diff-panel">
      <div class="drawer-header">
        <h3>Changes Overview</h3>
        <div class="header-actions">
          <Button
            v-if="hasChanges"
            icon="pi pi-copy"
            label="Copy as Markdown"
            size="small"
            severity="secondary"
            @click="copyAsMarkdown"
            :loading="copying"
            aria-label="Copy changes as markdown"
          />
        </div>
      </div>

      <ScrollPanel style="height: 100%">
        <div
          ref="diffContainer"
          class="diff-container"
          role="region"
          aria-label="Changes content"
        >
          <div class="summary-sticky">
            <div class="summary-grid">
              <button
                class="summary-pill added"
                :class="{ active: filter === 'added' }"
                @click="setFilter('added')"
              >
                <Tag severity="success">Added</Tag>
                <div class="pill-count">
                  {{
                    typeCounts.added.endpoints +
                    typeCounts.added.components +
                    typeCounts.added.info +
                    typeCounts.added.servers
                  }}
                </div>
                <div class="pill-sub">
                  <span>{{ typeCounts.added.endpoints }} paths</span>
                  <span v-if="typeCounts.added.components"
                    >, {{ typeCounts.added.components }} components</span
                  >
                  <span v-if="typeCounts.added.info"
                    >, {{ typeCounts.added.info }} info</span
                  >
                  <span v-if="typeCounts.added.servers"
                    >, {{ typeCounts.added.servers }} servers</span
                  >
                </div>
              </button>

              <button
                class="summary-pill modified"
                :class="{ active: filter === 'modified' }"
                @click="setFilter('modified')"
              >
                <Tag severity="warn">Modified</Tag>
                <div class="pill-count">
                  {{
                    typeCounts.modified.endpoints +
                    typeCounts.modified.components +
                    typeCounts.modified.info +
                    typeCounts.modified.servers
                  }}
                </div>
                <div class="pill-sub">
                  <span>{{ typeCounts.modified.endpoints }} paths</span>
                  <span v-if="typeCounts.modified.components"
                    >, {{ typeCounts.modified.components }} components</span
                  >
                  <span v-if="typeCounts.modified.info"
                    >, {{ typeCounts.modified.info }} info</span
                  >
                  <span v-if="typeCounts.modified.servers"
                    >, {{ typeCounts.modified.servers }} servers</span
                  >
                </div>
              </button>

              <button
                class="summary-pill removed"
                :class="{ active: filter === 'removed' }"
                @click="setFilter('removed')"
              >
                <Tag severity="danger">Removed</Tag>
                <div class="pill-count">
                  {{
                    typeCounts.removed.endpoints +
                    typeCounts.removed.components +
                    typeCounts.removed.info +
                    typeCounts.removed.servers
                  }}
                </div>
                <div class="pill-sub">
                  <span>{{ typeCounts.removed.endpoints }} paths</span>
                  <span v-if="typeCounts.removed.components"
                    >, {{ typeCounts.removed.components }} components</span
                  >
                  <span v-if="typeCounts.removed.info"
                    >, {{ typeCounts.removed.info }} info</span
                  >
                  <span v-if="typeCounts.removed.servers"
                    >, {{ typeCounts.removed.servers }} servers</span
                  >
                </div>
              </button>

              <div class="search-wrap">
                <input
                  v-model="search"
                  type="text"
                  placeholder="Filter changes..."
                  class="p-inputtext p-component"
                />
              </div>
            </div>
          </div>

          <div v-if="!hasChanges" class="no-changes">
            <i class="pi pi-check-circle"></i>
            <h3>No Changes</h3>
            <p>The specification hasn't been modified.</p>
          </div>

          <div v-else class="cards-area">
            <!-- Endpoints -->
            <div
              class="section-group endpoints-section"
              v-if="endpoints.length"
            >
              <div class="section-header">
                <h4>Paths ({{ endpoints.length }})</h4>
                <Button
                  icon="pi pi-angle-down"
                  class="p-button-text"
                  @click="toggleSection('endpoints')"
                />
              </div>
              <div v-show="expandedSections.endpoints" class="endpoints-list">
                <div
                  v-for="(item, idx) in endpoints"
                  :key="cardKey(item, idx)"
                  class="endpoint-line"
                >
                  <span class="endpoint-text"
                    ><span class="endpoint-left"
                      ><Tag
                        :style="{
                          backgroundColor: getMethodColor(item.method),
                          color: 'white',
                        }"
                        >{{ item.method }}</Tag
                      >
                      {{ item.path }}</span
                    ></span
                  >
                  <span class="endpoint-summary">{{ item.summary }}</span>
                  <div class="card-actions">
                    <Button
                      icon="pi pi-eye"
                      class="p-button-text"
                      @click="openDetails(item)"
                      aria-label="Open details"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Schemas / Components -->
            <div v-if="schemas.length" class="section-group endpoints-section">
              <div class="section-header">
                <h4>Components ({{ schemas.length }})</h4>
                <Button
                  icon="pi pi-angle-down"
                  class="p-button-text"
                  @click="toggleSection('schemas')"
                />
              </div>
              <div v-show="expandedSections.schemas" class="cards-grid">
                <div v-if="schemas.length === 0" class="no-items">
                  No components/schemas
                </div>
                <div
                  v-for="(item, idx) in schemas"
                  :key="cardKey(item, idx)"
                  class="schema-card"
                >
                  <div class="card-left">
                    <div class="schema-header">
                      <i class="pi pi-sitemap"></i>
                      <code class="schema-name">{{ item.name }}</code>
                    </div>
                  </div>
                  <div class="card-details">
                    <div
                      v-if="item.changeType === 'added'"
                      class="schema-preview"
                    >
                      <div
                        v-if="
                          item.dereferencedSchema?.title &&
                          item.dereferencedSchema?.title !== item.name
                        "
                        class="schema-title"
                      >
                        {{ item.dereferencedSchema?.title }}
                      </div>
                      <div
                        v-if="item.dereferencedSchema?.description"
                        class="schema-desc"
                      >
                        {{ item.dereferencedSchema?.description }}
                      </div>
                      <div
                        v-if="
                          item.dereferencedSchema?.type &&
                          item.dereferencedSchema?.type !== 'object'
                        "
                        class="schema-type"
                      >
                        Type: {{ item.dereferencedSchema?.type }}
                      </div>
                      <div v-if="!item.dereferencedSchema?.properties">
                        <pre
                          class="mini-json"
                        ><code>{{ prettyJSON(item.dereferencedSchema) }}</code></pre>
                      </div>
                    </div>
                    <div v-else class="mini-section">
                      <div class="mini-label">Schema reference</div>
                      <pre
                        class="mini-json"
                      ><code>{{ prettyJSON({ "$ref": "#/components/schemas/" + item.name }) }}</code></pre>
                    </div>
                  </div>
                  <div class="card-right">
                    <div class="card-actions">
                      <Button
                        icon="pi pi-eye"
                        class="p-button-text"
                        @click="openDetails(item)"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Info -->
            <div v-if="infos.length" class="section-group endpoints-section">
              <div class="section-header">
                <h4>Info ({{ infos.length }})</h4>
                <Button
                  icon="pi pi-angle-down"
                  class="p-button-text"
                  @click="toggleSection('info')"
                />
              </div>
              <div v-show="expandedSections.info" class="cards-grid">
                <div v-if="infos.length === 0" class="no-items">
                  No info items
                </div>
                <div
                  v-for="(item, idx) in infos"
                  :key="cardKey(item, idx)"
                  class="endpoint-card"
                >
                  <div class="card-left">
                    <Tag severity="info">{{ item.key }}</Tag>
                    <div class="short">
                      {{
                        item.changeType === "modified"
                          ? item.newValue
                          : item.value
                      }}
                    </div>
                  </div>
                  <div class="card-details">
                    <div
                      v-if="item.changeType === 'removed'"
                      class="mini-section"
                    >
                      <div class="mini-label">Value</div>
                      <div class="change-value removed">
                        <span class="label">Removed:</span>
                        <code>{{ item.value }}</code>
                      </div>
                    </div>
                  </div>
                  <div class="card-right">
                    <div class="card-actions">
                      <Button
                        icon="pi pi-eye"
                        class="p-button-text"
                        @click="openDetails(item)"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Servers -->
            <div v-if="servers.length" class="section-group endpoints-section">
              <div class="section-header">
                <h4>Servers</h4>
                <Button
                  icon="pi pi-angle-down"
                  class="p-button-text"
                  @click="toggleSection('servers')"
                />
              </div>
              <div v-show="expandedSections.servers" class="cards-grid">
                <div v-if="servers.length === 0" class="no-items">
                  No servers
                </div>
                <div
                  v-for="(item, idx) in servers"
                  :key="cardKey(item, idx)"
                  class="schema-card"
                >
                  <div class="card-left">
                    <div class="schema-header">
                      <i class="pi pi-server"></i>
                      <div>
                        <div class="server-name">
                          {{
                            getFormattedValue(item.value)?.url ||
                            item.key ||
                            getFormattedValue(item.value)?.description ||
                            item.value
                          }}
                        </div>
                        <div class="server-desc">
                          {{
                            getFormattedValue(item.value)?.description ||
                            getFormattedValue(item.value)?.url ||
                            ""
                          }}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="card-details">
                    <div
                      v-if="item.changeType === 'removed'"
                      class="mini-section"
                    >
                      <div class="mini-label">Value</div>
                      <div class="change-value removed">
                        <span class="label">Removed:</span>
                        <code>{{ item.value }}</code>
                      </div>
                    </div>
                  </div>
                  <div class="card-right">
                    <div class="card-actions">
                      <Button
                        icon="pi pi-eye"
                        class="p-button-text"
                        @click="openDetails(item)"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollPanel>
    </div>

    <!-- Drawer mode -->
    <Drawer
      v-else
      :visible="visible"
      @update:visible="$emit('update:visible', $event)"
      position="right"
      :style="{ width: '60vw' }"
    >
      <template #header>
        <div class="drawer-header">
          <h3>Changes Overview</h3>
          <div class="header-actions">
            <Button
              v-if="hasChanges"
              icon="pi pi-copy"
              label="Copy as Markdown"
              size="small"
              severity="secondary"
              @click="copyAsMarkdown"
              :loading="copying"
            />
          </div>
        </div>
      </template>

      <ScrollPanel style="height: 100%">
        <div
          ref="diffContainer"
          class="diff-container"
          role="region"
          aria-label="Changes content"
        >
          <div class="summary-sticky">
            <div class="summary-grid">
              <button
                class="summary-pill added"
                :class="{ active: filter === 'added' }"
                @click="setFilter('added')"
              >
                <Tag severity="success">Added</Tag>
                <div class="pill-count">
                  {{
                    typeCounts.added.endpoints +
                    typeCounts.added.components +
                    typeCounts.added.info +
                    typeCounts.added.servers
                  }}
                </div>
                <div class="pill-sub">
                  <span>{{ typeCounts.added.endpoints }} paths</span>
                  <span v-if="typeCounts.added.components"
                    >, {{ typeCounts.added.components }} components</span
                  >
                  <span v-if="typeCounts.added.info"
                    >, {{ typeCounts.added.info }} info</span
                  >
                  <span v-if="typeCounts.added.servers"
                    >, {{ typeCounts.added.servers }} servers</span
                  >
                </div>
              </button>

              <button
                class="summary-pill modified"
                :class="{ active: filter === 'modified' }"
                @click="setFilter('modified')"
              >
                <Tag severity="warn">Modified</Tag>
                <div class="pill-count">
                  {{
                    typeCounts.modified.endpoints +
                    typeCounts.modified.components +
                    typeCounts.modified.info +
                    typeCounts.modified.servers
                  }}
                </div>
                <div class="pill-sub">
                  <span>{{ typeCounts.modified.endpoints }} paths</span>
                  <span v-if="typeCounts.modified.components"
                    >, {{ typeCounts.modified.components }} components</span
                  >
                  <span v-if="typeCounts.modified.info"
                    >, {{ typeCounts.modified.info }} info</span
                  >
                  <span v-if="typeCounts.modified.servers"
                    >, {{ typeCounts.modified.servers }} servers</span
                  >
                </div>
              </button>

              <button
                class="summary-pill removed"
                :class="{ active: filter === 'removed' }"
                @click="setFilter('removed')"
              >
                <Tag severity="danger">Removed</Tag>
                <div class="pill-count">
                  {{
                    typeCounts.removed.endpoints +
                    typeCounts.removed.components +
                    typeCounts.removed.info +
                    typeCounts.removed.servers
                  }}
                </div>
                <div class="pill-sub">
                  <span>{{ typeCounts.removed.endpoints }} paths</span>
                  <span v-if="typeCounts.removed.components"
                    >, {{ typeCounts.removed.components }} components</span
                  >
                  <span v-if="typeCounts.removed.info"
                    >, {{ typeCounts.removed.info }} info</span
                  >
                  <span v-if="typeCounts.removed.servers"
                    >, {{ typeCounts.removed.servers }} servers</span
                  >
                </div>
              </button>

              <div class="search-wrap">
                <input
                  v-model="search"
                  type="text"
                  placeholder="Filter changes..."
                  class="p-inputtext p-component"
                />
              </div>
            </div>
          </div>

          <div v-if="!hasChanges" class="no-changes">
            <i class="pi pi-check-circle"></i>
            <h3>No Changes</h3>
            <p>The specification hasn't been modified.</p>
          </div>

          <div v-else class="cards-area">
            <!-- Endpoints -->
            <div
              class="section-group endpoints-section"
              v-if="endpoints.length"
            >
              <div class="section-header">
                <h4>Paths ({{ endpoints.length }})</h4>
                <Button
                  icon="pi pi-angle-down"
                  class="p-button-text"
                  @click="toggleSection('endpoints')"
                />
              </div>
              <div v-show="expandedSections.endpoints" class="endpoints-list">
                <div
                  v-for="(item, idx) in endpoints"
                  :key="cardKey(item, idx)"
                  class="endpoint-line"
                >
                  <span class="endpoint-text"
                    ><span class="endpoint-left"
                      ><Tag
                        :style="{
                          backgroundColor: getMethodColor(item.method),
                          color: 'white',
                        }"
                        >{{ item.method }}</Tag
                      >
                      {{ item.path }}</span
                    ></span
                  >
                  <span class="endpoint-summary">{{ item.summary }}</span>
                  <div class="card-actions">
                    <Button
                      icon="pi pi-eye"
                      class="p-button-text"
                      @click="openDetails(item)"
                      aria-label="Open details"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Schemas / Components -->
            <div v-if="schemas.length" class="section-group endpoints-section">
              <div class="section-header">
                <h4>Components ({{ schemas.length }})</h4>
                <Button
                  icon="pi pi-angle-down"
                  class="p-button-text"
                  @click="toggleSection('schemas')"
                />
              </div>
              <div v-show="expandedSections.schemas" class="cards-grid">
                <div v-if="schemas.length === 0" class="no-items">
                  No components/schemas
                </div>
                <div
                  v-for="(item, idx) in schemas"
                  :key="cardKey(item, idx)"
                  class="schema-card"
                >
                  <div class="card-left">
                    <div class="schema-header">
                      <i class="pi pi-sitemap"></i>
                      <code class="schema-name">{{ item.name }}</code>
                      <Tag
                        :severity="getChangeSeverity(item.changeType)"
                        size="small"
                        class="change-type-tag"
                        >{{ item.changeType }}</Tag
                      >
                    </div>
                  </div>
                  <div class="card-details">
                    <div class="schema-overview">
                      <div
                        v-if="
                          item.dereferencedSchema?.type &&
                          item.dereferencedSchema?.type !== 'object'
                        "
                        class="schema-type"
                      >
                        <strong>Type:</strong>
                        {{ item.dereferencedSchema?.type }}
                      </div>
                      <div
                        v-if="item.dereferencedSchema?.description"
                        class="schema-desc"
                      >
                        {{ item.dereferencedSchema?.description }}
                      </div>
                      <div
                        v-if="item.changeType === 'modified'"
                        class="schema-changes"
                      >
                        <div class="change-summary">
                          <span
                            v-if="item.propertiesAdded?.length"
                            class="change-added"
                            >+{{ item.propertiesAdded.length }} added</span
                          >
                          <span
                            v-if="item.propertiesRemoved?.length"
                            class="change-removed"
                            >-{{ item.propertiesRemoved.length }} removed</span
                          >
                          <span
                            v-if="item.propertiesModified?.length"
                            class="change-modified"
                            >~{{
                              item.propertiesModified.length
                            }}
                            modified</span
                          >
                          <span v-if="item.typeChanged" class="change-modified"
                            >Type changed</span
                          >
                          <span
                            v-if="item.requiredChanged"
                            class="change-modified"
                            >Required changed</span
                          >
                        </div>
                      </div>
                    </div>
                    <div
                      v-if="item.dereferencedSchema?.properties"
                      class="schema-properties"
                    >
                      <Button
                        :icon="
                          expandedSchemas[item.name]
                            ? 'pi pi-chevron-down'
                            : 'pi pi-chevron-right'
                        "
                        class="p-button-text p-button-sm expand-btn"
                        @click="toggleSchemaExpand(item.name)"
                        aria-label="Toggle properties"
                      />
                      <span class="properties-count"
                        >{{
                          Object.keys(item.dereferencedSchema?.properties || {})
                            .length
                        }}
                        properties</span
                      >
                      <div
                        v-show="expandedSchemas[item.name]"
                        class="properties-list"
                      >
                        <div
                          v-for="(prop, propName) in item.dereferencedSchema
                            .properties"
                          :key="propName"
                          class="property-item"
                          :class="getPropertyChangeClass(item, propName)"
                        >
                          <div class="prop-left">
                            <code class="prop-name">{{ propName }}</code>
                            <span class="prop-type">{{
                              prop.type || "object"
                            }}</span>
                            <Tag
                              v-if="
                                (
                                  item.dereferencedSchema?.required || []
                                ).includes(propName)
                              "
                              severity="danger"
                              size="small"
                              >Req</Tag
                            >
                          </div>
                          <div class="prop-right">
                            <span
                              v-if="getPropertyChangeType(item, propName)"
                              class="change-indicator"
                              >{{ getPropertyChangeType(item, propName) }}</span
                            >
                          </div>
                          <span v-if="prop.title" class="prop-title">{{
                            prop.title
                          }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="card-right">
                    <div class="change-hints">
                      <span v-if="item.changeType !== 'added'" class="hint"
                        >{{ item.changeCount }} changes</span
                      >
                    </div>
                    <div class="card-actions">
                      <Button
                        icon="pi pi-eye"
                        class="p-button-text"
                        @click="openDetails(item)"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Info -->
            <div v-if="infos.length" class="section-group endpoints-section">
              <div class="section-header">
                <h4>Info ({{ infos.length }})</h4>
                <Button
                  icon="pi pi-angle-down"
                  class="p-button-text"
                  @click="toggleSection('info')"
                />
              </div>
              <div v-show="expandedSections.info" class="cards-grid">
                <div v-if="infos.length === 0" class="no-items">
                  No info items
                </div>
                <div
                  v-for="(item, idx) in infos"
                  :key="cardKey(item, idx)"
                  class="endpoint-card"
                >
                  <div class="card-left">
                    <Tag
                      v-if="item.key && item.changeType !== 'modified'"
                      severity="info"
                      >{{ item.key }}</Tag
                    >
                    <div class="short">
                      {{
                        item.changeType === "modified"
                          ? item.oldValue
                          : item.value
                      }}
                    </div>
                  </div>
                  <div class="card-details">
                    <div
                      v-if="item.changeType !== 'modified'"
                      class="mini-section"
                    >
                      <div class="mini-label">Value</div>
                      <div
                        v-if="item.changeType === 'added'"
                        class="change-value added"
                      >
                        <span class="label">Added:</span>
                        <code>{{ item.value }}</code>
                      </div>
                      <div
                        v-if="item.changeType === 'removed'"
                        class="change-value removed"
                      >
                        <span class="label">Removed:</span>
                        <code>{{ item.value }}</code>
                      </div>
                      <div
                        v-if="item.changeType === 'modified'"
                        class="change-value modified"
                      ></div>
                    </div>
                  </div>
                  <div class="card-right">
                    <div class="card-actions">
                      <Button
                        icon="pi pi-eye"
                        class="p-button-text"
                        @click="openDetails(item)"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Servers -->
            <div v-if="servers.length" class="section-group endpoints-section">
              <div class="section-header">
                <h4>Servers</h4>
                <Button
                  icon="pi pi-angle-down"
                  class="p-button-text"
                  @click="toggleSection('servers')"
                />
              </div>
              <div v-show="expandedSections.servers" class="cards-grid">
                <div v-if="servers.length === 0" class="no-items">
                  No servers
                </div>
                <div
                  v-for="(item, idx) in servers"
                  :key="cardKey(item, idx)"
                  class="schema-card"
                >
                  <div class="card-left">
                    <div class="schema-header">
                      <i class="pi pi-server"></i>
                      <div>
                        <div class="server-name">
                          {{
                            getFormattedValue(item.value)?.url ||
                            item.key ||
                            getFormattedValue(item.value)?.description ||
                            item.value
                          }}
                        </div>
                        <div class="server-desc">
                          {{
                            getFormattedValue(item.value)?.description ||
                            getFormattedValue(item.value)?.url ||
                            ""
                          }}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="card-details">
                    <div
                      v-if="item.changeType === 'removed'"
                      class="mini-section"
                    >
                      <div class="mini-label">Value</div>
                      <div class="change-value removed">
                        <span class="label">Removed:</span>
                        <code>{{ item.value }}</code>
                      </div>
                    </div>
                  </div>
                  <div class="card-right">
                    <div class="card-actions">
                      <Button
                        icon="pi pi-eye"
                        class="p-button-text"
                        @click="openDetails(item)"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollPanel>
    </Drawer>

    <!-- Details dialog -->
    <Dialog
      :visible="detailOpen"
      @update:visible="setDetailOpen"
      header="Change Details"
      :modal="true"
      :closable="true"
      :style="{ width: '70vw' }"
    >
      <div v-if="selectedItem">
        <div class="detail-header">
          <div class="detail-left">
            <span class="header-left-label">{{
              selectedItem.key || selectedItem.name
            }}</span>
            <Tag
              v-if="selectedItem.method"
              :severity="getMethodSeverity(selectedItem.method)"
              >{{ selectedItem.method }}</Tag
            >
            <code class="detail-path">{{ selectedItem.path }}</code>
            <div v-if="selectedItem.summary" class="detail-summary">
              {{ selectedItem.summary }}
            </div>
            <div
              v-if="selectedItem.dereferencedSchema?.description"
              class="detail-summary"
            >
              {{ selectedItem.dereferencedSchema?.description }}
            </div>
          </div>
          <div class="detail-actions">
            <Button
              icon="pi pi-copy"
              label="Copy Markdown"
              class="p-button-text"
              @click="copyItemMarkdown"
            />
          </div>
        </div>

        <div class="detail-body">
          <section v-if="selectedItem.diffDetails">
            <h5>Field-level changes</h5>
            <div class="fields-grid">
              <div
                v-for="(f, i) in selectedItem.diffDetails.fields || []"
                :key="i"
                class="field-row change-header"
              >
                <div class="field-name">{{ formatFieldName(f.field) }}</div>
                <div class="field-old">
                  <code>{{ f.old ?? "—" }}</code>
                </div>
                <div class="field-arrow">➡</div>
                <div class="field-new">
                  <code>{{ f.new ?? "—" }}</code>
                </div>
              </div>
            </div>
          </section>

          <section v-if="selectedItem.method">
            <h5>Endpoint Details</h5>
            <div class="endpoint-details">
              <div v-if="selectedItem.description" class="detail-section">
                <h6>📝 Description</h6>
                <p>{{ selectedItem.description }}</p>
              </div>

              <div
                v-if="selectedItem.parameters && selectedItem.parameters.length"
                class="detail-section parameters-section"
              >
                <h6>📋 Parameters</h6>
                <div class="parameters-table">
                  <table class="p-datatable p-datatable-sm">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>In</th>
                        <th>Required</th>
                        <th>Type</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="param in selectedItem.parameters"
                        :key="param.name"
                      >
                        <td>
                          <code>{{ param.name }}</code>
                        </td>
                        <td>{{ param.in }}</td>
                        <td>
                          <Tag v-if="param.required" severity="danger"
                            >Required</Tag
                          >
                          <Tag v-else severity="success">Optional</Tag>
                        </td>
                        <td>{{ param.schema?.type || "object" }}</td>
                        <td>{{ param.description || "-" }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div v-if="selectedItem.requestBody" class="detail-section">
                <h6>📤 Request Body</h6>
                <div
                  v-if="selectedItem.requestBody.description"
                  class="body-desc"
                >
                  {{ selectedItem.requestBody.description }}
                </div>
                <div
                  v-if="selectedItem.requestBody.content"
                  class="content-list"
                >
                  <div
                    v-for="(content, type) in selectedItem.requestBody.content"
                    :key="type"
                    class="content-item"
                  >
                    <div v-if="content.schema" class="schema-preview">
                      <div
                        v-if="dereferenceSchema(content.schema).title"
                        class="schema-title"
                      >
                        {{ dereferenceSchema(content.schema).title }}
                      </div>
                      <div
                        v-if="dereferenceSchema(content.schema).description"
                        class="schema-desc"
                      >
                        {{ dereferenceSchema(content.schema).description }}
                      </div>
                      <div
                        v-if="dereferenceSchema(content.schema).type"
                        class="schema-type"
                      >
                        Type: {{ dereferenceSchema(content.schema).type }}
                      </div>
                      <div
                        v-if="dereferenceSchema(content.schema).properties"
                        class="properties-list"
                      >
                        <div
                          v-for="(prop, name) in dereferenceSchema(
                            content.schema
                          ).properties"
                          :key="name"
                          class="property-item"
                        >
                          <code class="prop-name">{{ name }}</code>
                          <span class="prop-type">{{
                            prop.type || "object"
                          }}</span>
                          <span v-if="prop.description" class="prop-desc">{{
                            prop.description
                          }}</span>
                          <span v-if="prop.title" class="prop-title">{{
                            prop.title.replace(/^\(|\)$/g, "")
                          }}</span>
                        </div>
                      </div>
                      <div v-else>
                        <pre
                          class="mini-json"
                        ><code>{{ prettyJSON(dereferenceSchema(content.schema)) }}</code></pre>
                      </div>
                    </div>
                    <div v-if="content.example" class="example-preview">
                      <strong>Example:</strong>
                      <pre
                        class="mini-json"
                      ><code>{{ prettyJSON(content.example) }}</code></pre>
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="selectedItem.responses" class="detail-section">
                <h6>📥 Responses</h6>
                <div class="responses-list">
                  <div
                    v-for="(response, code) in selectedItem.responses"
                    :key="code"
                    class="response-item"
                  >
                    <div class="response-header">
                      <Tag :severity="getResponseSeverity(code)" size="small">{{
                        code
                      }}</Tag>
                      <span class="response-desc">{{
                        response.description
                      }}</span>
                    </div>
                    <div v-if="response.content" class="response-content">
                      <div
                        v-for="(content, type) in response.content"
                        :key="type"
                        class="content-item"
                      >
                        <div v-if="content.schema" class="schema-preview">
                          <div
                            v-if="dereferenceSchema(content.schema).title"
                            class="schema-title"
                          >
                            {{ dereferenceSchema(content.schema).title }}
                          </div>
                          <div
                            v-if="dereferenceSchema(content.schema).description"
                            class="schema-desc"
                          >
                            {{ dereferenceSchema(content.schema).description }}
                          </div>
                          <div
                            v-if="dereferenceSchema(content.schema).type"
                            class="schema-type"
                          >
                            Type: {{ dereferenceSchema(content.schema).type }}
                          </div>
                          <div
                            v-if="dereferenceSchema(content.schema).properties"
                            class="properties-list"
                          >
                            <div
                              v-for="(prop, name) in dereferenceSchema(
                                content.schema
                              ).properties"
                              :key="name"
                              class="property-item"
                            >
                              <code class="prop-name">{{ name }}</code>
                              <Tag
                                v-if="
                                  dereferenceSchema(content.schema).required &&
                                  Array.isArray(
                                    dereferenceSchema(content.schema).required
                                  ) &&
                                  dereferenceSchema(
                                    content.schema
                                  ).required.includes(name)
                                "
                                severity="danger"
                                size="small"
                                >Req</Tag
                              >
                              <span class="prop-type">{{
                                prop.type || "object"
                              }}</span>
                              <span v-if="prop.description" class="prop-desc">{{
                                prop.description
                              }}</span>
                              <span v-if="prop.title" class="prop-title">{{
                                prop.title.replace(/^\(|\)$/g, "")
                              }}</span>
                            </div>
                          </div>
                          <div v-else>
                            <pre
                              class="mini-json"
                            ><code>{{ prettyJSON(dereferenceSchema(content.schema)) }}</code></pre>
                          </div>
                        </div>
                        <div v-if="content.example" class="example-preview">
                          <strong>Example:</strong>
                          <pre
                            class="mini-json"
                          ><code>{{ prettyJSON(content.example) }}</code></pre>
                        </div>
                      </div>
                    </div>
                    <div v-else>No content defined</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section
            v-if="
              selectedItem.changeType === 'modified' &&
              selectedItem.propertiesAdded
            "
          >
            <h5>Schema Changes</h5>
            <div class="schema-changes-detail">
              <div
                v-if="selectedItem.propertiesAdded.length"
                class="change-group"
              >
                <h6>Added Properties</h6>
                <ul>
                  <li
                    v-for="prop in selectedItem.propertiesAdded"
                    :key="prop.name"
                  >
                    {{ prop.name }}
                  </li>
                </ul>
              </div>
              <div
                v-if="selectedItem.propertiesRemoved.length"
                class="change-group"
              >
                <h6>Removed Properties</h6>
                <ul>
                  <li
                    v-for="prop in selectedItem.propertiesRemoved"
                    :key="prop.name"
                  >
                    {{ prop.name }}
                  </li>
                </ul>
              </div>
              <div
                v-if="selectedItem.propertiesModified.length"
                class="change-group"
              >
                <h6>Modified Properties</h6>
                <ul>
                  <li
                    v-for="prop in selectedItem.propertiesModified"
                    :key="prop.name"
                  >
                    {{ prop.name }}
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <section
            v-if="
              selectedItem.changeType === 'added' &&
              selectedItem.dereferencedSchema?.properties
            "
          >
            <h5>Schema Properties</h5>
            <div class="properties-list">
              <div
                v-for="(prop, name) in selectedItem.dereferencedSchema
                  .properties"
                :key="name"
                class="property-item"
              >
                <code class="prop-name">{{ name }}</code>
                <span class="prop-type">{{ prop.type || "object" }}</span>
                <span v-if="prop.description" class="prop-desc">{{
                  prop.description
                }}</span>
                <span v-if="prop.title" class="prop-title">{{
                  prop.title.replace(/^\(|\)$/g, "")
                }}</span>
                <Tag
                  v-if="
                    (selectedItem.dereferencedSchema?.required || []).includes(
                      name
                    )
                  "
                  severity="danger"
                  size="small"
                  >Req</Tag
                >
              </div>
            </div>
          </section>

          <section
            v-if="
              selectedItem.changeType === 'modified' && selectedItem.oldValue
            "
          >
            <h5>Info Change</h5>
            <div class="detail-section no-hover" style="margin-bottom: 16px">
              <h6>⏪ Before</h6>
              <div class="before-value">
                {{ truncate(selectedItem.oldValue || "", 200) }}
              </div>
            </div>
            <div class="detail-section no-hover">
              <h6>⏩ After</h6>
              <div class="before-value">
                {{ truncate(selectedItem.newValue || "", 200) }}
              </div>
            </div>
          </section>

          <section
            v-if="selectedItem.value && !selectedItem.method"
            class="detail-section"
          >
            <h5>Server Details</h5>
            <div>
              <div v-if="getFormattedValue(selectedItem.value)?.url">
                <h6>🔗 URL</h6>
                <div class="before-value">
                  <code>{{ getFormattedValue(selectedItem.value).url }}</code>
                </div>
              </div>
              <div
                v-if="getFormattedValue(selectedItem.value)?.description"
                style="margin-top: 12px"
              >
                <h6>📝 Description</h6>
                <p>{{ getFormattedValue(selectedItem.value).description }}</p>
              </div>
              <div
                v-if="getFormattedValue(selectedItem.value)?.variables"
                style="margin-top: 12px"
              >
                <h6>⚙️ Variables</h6>
                <div class="properties-list">
                  <div
                    v-for="(v, name) in getFormattedValue(selectedItem.value)
                      .variables"
                    :key="name"
                    class="property-item"
                  >
                    <code class="prop-name">{{ name }}</code>
                    <div class="prop-desc">{{ v.description || "-" }}</div>
                    <div class="prop-type" style="margin-left: auto">
                      {{
                        v.default !== undefined ? "Default: " + v.default : ""
                      }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div class="json-toggle">
            <Button
              :icon="showJson ? 'pi pi-eye-slash' : 'pi pi-eye'"
              :label="showJson ? 'Hide JSON' : 'Show JSON'"
              class="p-button-text p-button-sm"
              @click="showJson = !showJson"
            />
          </div>

          <section v-if="showJson">
            <h5>JSON Preview</h5>
            <pre
              class="json-preview"
            ><code>{{ prettyJSON(selectedItem.raw || selectedItem) }}</code></pre>
          </section>
        </div>
      </div>
      <template #footer>
        <Button label="Close" icon="pi pi-times" @click="detailOpen = false" />
      </template>
    </Dialog>
  </div>
</template>

<script>
import { ref, computed, watch } from "vue";
import Drawer from "primevue/drawer";
import Dialog from "primevue/dialog";
import Button from "primevue/button";
import Tag from "primevue/tag";
import ScrollPanel from "primevue/scrollpanel";
import { generateMarkdownReport } from "../utils/markdownGenerator";

export default {
  name: "DiffDrawer",
  components: {
    Drawer,
    Dialog,
    Button,
    Tag,
    ScrollPanel,
  },
  props: {
    diff: {
      type: Object,
      default: () => ({ info: null, added: [], modified: [], removed: [] }),
    },
    spec: {
      type: Object,
      default: () => ({}),
    },
    inline: {
      type: Boolean,
      default: false,
    },
    visible: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["update:visible"],
  setup(props, { emit }) {
    const filter = ref("added");
    const search = ref("");
    const copying = ref(false);
    const detailOpen = ref(false);
    const selectedItem = ref(null);
    const showJson = ref(false);
    const expandedSections = ref({
      endpoints: true,
      schemas: true,
      info: true,
      servers: true,
    });
    const expandedSchemas = ref({});

    watch(
      () => props.diff,
      () => {
        // no-op for now; placeholder if we need to react to incoming diffs
      },
      { deep: true }
    );

    const summary = computed(() => {
      const d = props.diff || {};
      return {
        added:
          (d.infoAdded?.length || 0) +
          (d.added?.length || 0) +
          (d.schemaAdded?.length || 0) +
          (d.serverAdded?.length || 0),
        modified:
          (d.infoModified?.length || 0) +
          (d.modified?.length || 0) +
          (d.schemaModified?.length || 0) +
          (d.serverModified?.length || 0),
        removed:
          (d.infoRemoved?.length || 0) +
          (d.removed?.length || 0) +
          (d.schemaRemoved?.length || 0) +
          (d.serverRemoved?.length || 0),
      };
    });

    const hasChanges = computed(() => {
      const d = props.diff || {};
      return (
        (d.infoAdded?.length || 0) +
          (d.infoModified?.length || 0) +
          (d.infoRemoved?.length || 0) +
          (d.added?.length || 0) +
          (d.modified?.length || 0) +
          (d.removed?.length || 0) +
          (d.schemaAdded?.length || 0) +
          (d.schemaModified?.length || 0) +
          (d.schemaRemoved?.length || 0) >
        0
      );
    });

    const addedEndpoints = computed(() => {
      const d = props.diff || {};
      return (d.added || []).map((it) => ({ ...it, changeType: "added" }));
    });

    const modifiedEndpoints = computed(() => {
      const d = props.diff || {};
      return (d.modified || []).map((it) => ({
        ...it,
        changeType: "modified",
      }));
    });

    const removedEndpoints = computed(() => {
      const d = props.diff || {};
      return (d.removed || []).map((it) => ({ ...it, changeType: "removed" }));
    });

    const endpointsTotal = computed(
      () =>
        addedEndpoints.value.length +
        modifiedEndpoints.value.length +
        removedEndpoints.value.length
    );

    const endpoints = computed(() => {
      const q = search.value.trim().toLowerCase();

      let list = [];
      if (filter.value === "added") list = addedEndpoints.value;
      else if (filter.value === "modified") list = modifiedEndpoints.value;
      else if (filter.value === "removed") list = removedEndpoints.value;
      else
        list = [
          ...addedEndpoints.value,
          ...modifiedEndpoints.value,
          ...removedEndpoints.value,
        ];

      let filtered = list;
      if (q) {
        filtered = list.filter((it) => {
          return (
            (it.path || "").toLowerCase().includes(q) ||
            (it.method || "").toLowerCase().includes(q) ||
            (it.summary || "").toLowerCase().includes(q)
          );
        });
      }

      return filtered;
    });

    // debug watcher to log counts and current filter to help reproduce
    // cases where selecting an empty category shows other items
    watch(
      [addedEndpoints, modifiedEndpoints, removedEndpoints, filter, endpoints],
      () => {
        try {
          const d = props.diff || {};
          console.debug("[DiffDrawer] counts", {
            added: addedEndpoints.value.length,
            modified: modifiedEndpoints.value.length,
            removed: removedEndpoints.value.length,
            filter: filter.value,
            endpoints: Object.keys(endpoints.value).length,
          });

          // snapshot of incoming diff for quick inspection
          console.debug("[DiffDrawer] diff-keys", Object.keys(d));
          console.debug("[DiffDrawer] diff-snapshot", {
            addedSample: (d.added || []).slice(0, 3),
            modifiedSample: (d.modified || []).slice(0, 3),
            removedSample: (d.removed || []).slice(0, 3),
            infoAdded: (d.infoAdded || []).slice(0, 3),
            infoModified: (d.infoModified || []).slice(0, 3),
            infoRemoved: (d.infoRemoved || []).slice(0, 3),
            schemaAdded: (d.schemaAdded || []).slice(0, 3),
            schemaModified: (d.schemaModified || []).slice(0, 3),
            schemaRemoved: (d.schemaRemoved || []).slice(0, 3),
          });

          // detect possible inconsistency: diff.removed present but computed removedEndpoints empty
          if (
            d.removed &&
            (Array.isArray(d.removed) ? d.removed.length : 1) > 0 &&
            removedEndpoints.value.length === 0
          ) {
            console.warn(
              "[DiffDrawer] Inconsistency: props.diff.removed exists but removedEndpoints computed is empty",
              d.removed
            );
          }
        } catch (e) {
          // ignore logging errors in non-browser environments
        }
      }
    );

    // ensure that when user selects a filter with no items we collapse the endpoints
    // section so the UI doesn't accidentally show other lists.
    watch([filter, endpoints], () => {
      try {
        console.debug(
          "[DiffDrawer] endpoints items sample",
          Object.entries(endpoints.value).slice(0, 6)
        );
        // sections are dynamically managed by the watch on Object.keys(endpoints.value)
        try {
          console.debug("[DiffDrawer] schema lists", {
            schemaAdded: props.diff?.schemaAdded?.length ?? null,
            schemaModified: props.diff?.schemaModified?.length ?? null,
            schemaRemoved: props.diff?.schemaRemoved?.length ?? null,
          });
        } catch (e) {
          // ignore
        }
      } catch (e) {
        // ignore
      }
    });

    const typeCounts = computed(() => {
      const d = props.diff || {};
      return {
        added: {
          endpoints: (d.added || []).length,
          components: (d.schemaAdded || []).length,
          info:
            (d.infoAdded || []).length ||
            ((d.infoAdded || []).length === 0 &&
            (d.infoModified || []).length === 0 &&
            (d.infoRemoved || []).length === 0
              ? Object.keys(props.spec?.info || {}).filter((key) =>
                  ["title", "version", "description"].includes(key)
                ).length
              : 0),
          servers:
            (d.serverAdded || []).length ||
            ((d.serverAdded || []).length === 0 &&
            (d.serverModified || []).length === 0 &&
            (d.serverRemoved || []).length === 0
              ? (props.spec?.servers || []).length
              : 0),
        },
        modified: {
          endpoints: (d.modified || []).length,
          components: (d.schemaModified || []).length,
          info: (d.infoModified || []).length,
          servers: (d.serverModified || []).length,
        },
        removed: {
          endpoints: (d.removed || []).length,
          components: (d.schemaRemoved || []).length,
          info: (d.infoRemoved || []).length,
          servers: (d.serverRemoved || []).length,
        },
      };
    });

    const addedSchemas = computed(() => {
      const d = props.diff || {};
      return (d.schemaAdded || []).map((it) => {
        console.log(
          "[addedSchemas] Processing",
          it.name || it.key,
          "schema:",
          it.schema
        );
        const deref = dereferenceSchema(it.schema);
        console.log("[addedSchemas] Dereferenced:", deref);
        return {
          ...it,
          changeType: "added",
          name: it.name || it.key,
          dereferencedSchema: deref || {},
          changeCount: 1,
        };
      });
    });

    const modifiedSchemas = computed(() => {
      const d = props.diff || {};
      return (d.schemaModified || []).map((it) => {
        const fullSchema = props.spec?.components?.schemas?.[it.name];
        console.log(
          "[modifiedSchemas] Processing",
          it.name || it.key,
          "fullSchema:",
          fullSchema
        );
        const deref = dereferenceSchema(fullSchema);
        console.log("[modifiedSchemas] Dereferenced:", deref);
        const changeCount =
          (it.propertiesAdded?.length || 0) +
          (it.propertiesRemoved?.length || 0) +
          (it.propertiesModified?.length || 0) +
          (it.typeChanged ? 1 : 0) +
          (it.requiredChanged ? 1 : 0) +
          (it.enumChanged ? 1 : 0) +
          (it.formatChanged ? 1 : 0) +
          (it.validationChanged?.length || 0);
        return {
          ...it,
          changeType: "modified",
          name: it.name || it.key,
          dereferencedSchema: deref,
          changeCount,
        };
      });
    });

    const removedSchemas = computed(() => {
      const d = props.diff || {};
      return (d.schemaRemoved || []).map((it) => {
        console.log(
          "[removedSchemas] Processing",
          it.name || it.key,
          "schema:",
          it.schema
        );
        const deref = dereferenceSchema(it.schema);
        console.log("[removedSchemas] Dereferenced:", deref);
        return {
          ...it,
          changeType: "removed",
          name: it.name || it.key,
          dereferencedSchema: deref,
          changeCount: 1,
        };
      });
    });

    const schemas = computed(() => {
      const q = search.value.trim().toLowerCase();
      let list = [];
      if (filter.value === "added") list = addedSchemas.value;
      else if (filter.value === "modified") list = modifiedSchemas.value;
      else if (filter.value === "removed") list = removedSchemas.value;
      else
        list = [
          ...addedSchemas.value,
          ...modifiedSchemas.value,
          ...removedSchemas.value,
        ];

      if (!q) {
        const totalSchemaChanges =
          (addedSchemas.value?.length || 0) +
          (modifiedSchemas.value?.length || 0) +
          (removedSchemas.value?.length || 0);

        // Only inject current components when there are NO schema changes at all.
        if (!list.length && totalSchemaChanges === 0) {
          const currentSchemas = props.spec?.components?.schemas || {};
          list.push(
            ...Object.keys(currentSchemas).map((name) => ({
              key: name,
              name,
              changeType: "added",
              dereferencedSchema: dereferenceSchema(currentSchemas[name]),
            }))
          );
        }
        return list;
      }
      return list.filter((it) => {
        const name = (it.name || it.key || "").toLowerCase();
        const schemaText = JSON.stringify(
          it.dereferencedSchema || {}
        ).toLowerCase();
        return name.includes(q) || schemaText.includes(q);
      });
    });

    const schemasTotal = computed(
      () =>
        addedSchemas.value.length +
        modifiedSchemas.value.length +
        removedSchemas.value.length
    );

    const infos = computed(() => {
      const d = props.diff || {};
      const q = search.value.trim().toLowerCase();

      // build full list grouped by change type so we can apply filter
      let list = [
        ...(d.infoAdded || []).map((i) => ({
          key: i.key,
          value: i.value,
          changeType: "added",
        })),
        ...(d.infoModified || []).map((i) => ({
          key: i.key,
          oldValue: i.old,
          newValue: i.new,
          changeType: "modified",
        })),
        ...(d.infoRemoved || []).map((i) => ({
          key: i.key,
          value: i.value,
          changeType: "removed",
        })),
      ];

      // if no changes, add current info
      if (!list.length) {
        const currentInfo = props.spec?.info || {};
        for (const field of ["title", "version", "description"]) {
          if (currentInfo[field]) {
            list.push({
              key: field,
              value: currentInfo[field],
              changeType: "added",
            });
          }
        }
      }

      // apply top-level filter (added/modified/removed) similar to endpoints/schemas
      let filtered = [];
      if (filter.value === "added")
        filtered = list.filter((it) => it.changeType === "added");
      else if (filter.value === "modified")
        filtered = list.filter((it) => it.changeType === "modified");
      else if (filter.value === "removed")
        filtered = list.filter((it) => it.changeType === "removed");
      else filtered = list;

      // apply search
      if (q) {
        filtered = filtered.filter((it) => {
          return (
            (it.key || "").toLowerCase().includes(q) ||
            (String(it.value || "") || "").toLowerCase().includes(q)
          );
        });
      }

      return filtered;
    });

    const servers = computed(() => {
      const d = props.diff || {};
      const q = search.value.trim().toLowerCase();

      // build full list grouped by change type so we can apply filter
      let list = [
        ...(d.serverAdded || []).map((i) => ({
          key: i.key,
          value: i.value,
          changeType: "added",
        })),
        ...(d.serverModified || []).map((i) => ({
          key: i.key,
          oldValue: i.old,
          newValue: i.new,
          changeType: "modified",
        })),
        ...(d.serverRemoved || []).map((i) => ({
          key: i.key,
          value: i.value,
          changeType: "removed",
        })),
      ];

      // if no changes, add current servers
      if (!list.length) {
        const currentServers = props.spec?.servers || [];
        list.push(
          ...currentServers.map((s, i) => ({
            key: s.url || s.description || s.name || String(i),
            value: s,
            changeType: "added",
          }))
        );
      }

      // apply top-level filter (added/modified/removed) similar to endpoints/schemas
      let filtered = [];
      if (filter.value === "added")
        filtered = list.filter((it) => it.changeType === "added");
      else if (filter.value === "modified")
        filtered = list.filter((it) => it.changeType === "modified");
      else if (filter.value === "removed")
        filtered = list.filter((it) => it.changeType === "removed");
      else filtered = list;

      // apply search
      if (q) {
        filtered = filtered.filter((it) => {
          return (
            (it.key || "").toLowerCase().includes(q) ||
            (String(it.value || "") || "").toLowerCase().includes(q)
          );
        });
      }

      return filtered;
    });

    function getMethodSeverity(method) {
      const m = (method || "").toUpperCase();
      if (m === "GET") return "success";
      if (m === "POST") return "info";
      if (m === "PUT" || m === "PATCH") return "warn";
      if (m === "DELETE") return "danger";
      return "info";
    }

    function getResponseSeverity(code) {
      const c = parseInt(code);
      if (c >= 200 && c < 300) return "success";
      if (c >= 300 && c < 400) return "warn";
      if (c >= 400 && c < 500) return "danger";
      if (c >= 500) return "danger";
      return "info";
    }

    function getMethodColor(method) {
      const m = (method || "").toUpperCase();
      if (m === "GET") return "#10b981";
      if (m === "POST") return "#3b82f6";
      if (m === "PUT") return "#f59e0b";
      if (m === "PATCH") return "#eab308";
      if (m === "DELETE") return "#ef4444";
      return "#6b7280";
    }

    function prettyJSON(obj) {
      try {
        return JSON.stringify(obj, null, 2);
      } catch (e) {
        return String(obj);
      }
    }

    function truncate(str, n = 80) {
      if (!str) return "";
      return str.length > n ? str.slice(0, n - 1) + "…" : str;
    }

    function formatFieldName(f) {
      if (!f) return "";
      return String(f).replace(/\./g, " → ");
    }

    function getComponentName(ref) {
      if (!ref) return "";
      return ref.split("/").pop();
    }

    function dereferenceSchema(schema, visited = new Set()) {
      if (!schema || typeof schema !== "object") {
        console.log(
          "[dereferenceSchema] Invalid schema:",
          schema,
          "returning original"
        );
        return schema;
      }

      // Handle $ref
      if (schema.$ref) {
        const refPath = schema.$ref;
        if (refPath.startsWith("#/")) {
          const path = refPath.slice(2).split("/");
          let resolved = props.spec;
          for (const segment of path) {
            resolved = resolved?.[segment];
            if (resolved === undefined) break;
          }
          if (resolved && !visited.has(refPath)) {
            visited.add(refPath);
            const deref = dereferenceSchema(resolved, visited);
            visited.delete(refPath);
            return deref;
          }
        }
        // If can't resolve, return as is
        return schema;
      }

      // Recursively dereference nested objects
      const result = { ...schema };
      for (const key in result) {
        if (result[key] && typeof result[key] === "object") {
          result[key] = dereferenceSchema(result[key], visited);
        }
      }

      // Fix required field if it's not an array
      if (
        result &&
        typeof result.required !== "undefined" &&
        !Array.isArray(result.required)
      ) {
        console.log(
          "[Fixing] required is not an array, converting:",
          result.required
        );
        if (typeof result.required === "object") {
          result.required = Object.keys(result.required);
        } else {
          result.required = [];
        }
      }

      return result || {};
    }

    function cardKey(item, idx) {
      // Use multiple identifying fields and include changeType to avoid
      // Vue reusing DOM nodes between different lists (added vs modified).
      const name = item?.name || item?.key || item?.path || "";
      const method = item?.method || "";
      const type = item?.changeType || "";
      return `${name}-${method}-${type}-${idx}`;
    }

    function openDetails(item) {
      selectedItem.value = item;
      detailOpen.value = true;
      showJson.value = false;
    }

    function setDetailOpen(val) {
      detailOpen.value = val;
      if (!val) {
        selectedItem.value = null;
        showJson.value = false;
      }
    }

    const userSelectedFilter = ref(false);

    function setFilter(val) {
      // record user selection so we can show the endpoints section even when
      // the selected category is empty (shows "No endpoints")
      userSelectedFilter.value = true;
      filter.value = val;
    }

    function toggleSection(key) {
      expandedSections.value[key] = !expandedSections.value[key];
    }

    function toggleSchemaExpand(name) {
      expandedSchemas.value[name] = !expandedSchemas.value[name];
    }

    function getFormattedValue(value) {
      if (typeof value === "string") {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      return value;
    }

    function getChangeSeverity(changeType) {
      if (changeType === "added") return "success";
      if (changeType === "modified") return "warn";
      if (changeType === "removed") return "danger";
      return "info";
    }

    function getPropertyChangeType(item, propName) {
      if (item.changeType !== "modified") return null;
      if (item.propertiesAdded?.some((p) => p.name === propName)) return "+";
      if (item.propertiesRemoved?.some((p) => p.name === propName)) return "-";
      if (item.propertiesModified?.some((p) => p.name === propName)) return "~";
      return null;
    }

    function getPropertyChangeClass(item, propName) {
      const change = getPropertyChangeType(item, propName);
      if (change === "+") return "prop-added";
      if (change === "-") return "prop-removed";
      if (change === "~") return "prop-modified";
      return "";
    }

    async function copyAsMarkdown() {
      copying.value = true;
      try {
        const md = generateMarkdownReport(props.diff || {});
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(md);
        } else {
          const t = document.createElement("textarea");
          t.value = md;
          t.style.position = "fixed";
          t.style.left = "-9999px";
          document.body.appendChild(t);
          t.select();
          try {
            document.execCommand("copy");
          } finally {
            t.remove();
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        copying.value = false;
      }
    }

    async function copyItemMarkdown() {
      if (!selectedItem.value) return;
      const md = "```json\n" + prettyJSON(selectedItem.value) + "\n```";
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(md);
      } else {
        const t = document.createElement("textarea");
        t.value = md;
        document.body.appendChild(t);
        t.select();
        try {
          document.execCommand("copy");
        } finally {
          t.remove();
        }
      }
    }

    function exportItemJSON() {
      if (!selectedItem.value) return;
      const data = JSON.stringify(selectedItem.value, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "item.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    return {
      filter,
      search,
      copying,
      summary,
      typeCounts,
      hasChanges,
      endpoints,
      addedEndpoints,
      modifiedEndpoints,
      removedEndpoints,
      endpointsTotal,
      schemas,
      schemasTotal,
      infos,
      servers,
      expandedSections,
      expandedSchemas,
      toggleSection,
      toggleSchemaExpand,
      setFilter,
      getMethodSeverity,
      getMethodColor,
      getResponseSeverity,
      getChangeSeverity,
      getPropertyChangeType,
      getPropertyChangeClass,
      prettyJSON,
      truncate,
      formatFieldName,
      getComponentName,
      dereferenceSchema,
      cardKey,
      openDetails,
      detailOpen,
      selectedItem,
      setDetailOpen,
      showJson,
      copyItemMarkdown,
      copyAsMarkdown,
      getFormattedValue,
    };
  },
};
</script>

<style scoped>
.diff-panel {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
  overflow: hidden;
  border: 1px solid rgba(15, 23, 42, 0.04);
}
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.04);
}
.drawer-header h3 {
  margin: 0;
  font-size: 1rem;
}
.drawer-header .header-actions {
  display: flex;
  gap: 8px;
}
.diff-container {
  padding: 12px;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI",
    Roboto, "Helvetica Neue", Arial;
  color: #0f1724;
}
.summary-sticky {
  position: sticky;
  top: 0;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.9),
    rgba(255, 255, 255, 0.6)
  );
  padding-bottom: 8px;
  z-index: 4;
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  align-items: center;
  padding: 10px 0;
}
.summary-pill {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.04);
  background: #fff;
  cursor: pointer;
}
.summary-pill.added {
  border-color: rgba(16, 185, 129, 0.06);
}
.summary-pill.modified {
  border-color: rgba(245, 158, 11, 0.06);
}
.summary-pill.removed {
  border-color: rgba(244, 63, 94, 0.06);
}
.summary-pill .pill-count {
  font-weight: 700;
  color: #0f1724;
}
.summary-pill.active {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
}
.search-wrap {
  display: flex;
  align-items: center;
}
input.p-inputtext {
  width: 100%;
  border-radius: 8px;
  padding: 8px 10px;
  border: 1px solid rgba(15, 23, 42, 0.06);
}
.no-changes {
  text-align: center;
  padding: 2rem 1rem;
  color: #475569;
}
.no-changes i {
  font-size: 3rem;
  color: #10b981;
}
.cards-area {
  margin-top: 12px;
}
.endpoints-section {
  margin-bottom: 24px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
}
.endpoints-list {
  margin-top: 12px;
}
.endpoint-line {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 16px 20px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.04);
  margin-bottom: 12px;
  gap: 12px;
  font-size: 1rem;
}
.endpoint-text {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  font-weight: 600;
  color: #0f1724;
  flex: 1;
  display: flex;
  justify-content: flex-start;
  align-items: center;
}
.endpoint-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.endpoint-summary {
  margin-left: auto;
}
.cards-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}
.endpoint-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-radius: 10px;
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.04);
  box-shadow: 0 2px 8px rgba(2, 6, 23, 0.03);
  gap: 12px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.schema-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 16px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.04);
  box-shadow: 0 2px 8px rgba(2, 6, 23, 0.03);
  gap: 16px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.schema-card:hover {
  box-shadow: 0 4px 16px rgba(2, 6, 23, 0.08);
  transform: translateY(-2px);
  border-color: rgba(15, 23, 42, 0.08);
}

.endpoint-card:hover {
  box-shadow: 0 4px 16px rgba(2, 6, 23, 0.08);
  transform: translateY(-2px);
  border-color: rgba(15, 23, 42, 0.08);
}
.card-left {
  margin-top: 8px;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  white-space: nowrap;
}

.schema-card .card-left {
  align-items: flex-start;
  white-space: normal;
}
.path {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  color: #0f1724;
  font-weight: 600;
}
.short {
  color: #475569;
  font-size: 0.85rem;
}
.server-name {
  font-weight: 600;
  color: #0f1724;
  font-size: 0.95rem;
  flex: 1;
  min-width: 0;
  margin-right: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.server-desc {
  color: #64748b;
  font-size: 0.85rem;
  margin-top: 0;
  text-align: right;
  align-self: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-left: auto;
}
.endpoint-line {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  color: #0f1724;
  font-weight: 600;
}
.method-text {
  font-weight: bold;
}
.card-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.mini-section {
  background: #f8fafc;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.03);
}
.mini-label {
  font-size: 0.8rem;
  color: #6b7280;
  margin-bottom: 6px;
}
.mini-json {
  background: #0b1220;
  color: #d1fae5;
  padding: 8px;
  border-radius: 6px;
  max-height: 96px;
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  font-size: 0.78rem;
}
.mini-desc {
  color: #374151;
  font-size: 0.9rem;
}
.modified-inline {
  display: flex;
  gap: 8px;
  align-items: center;
  background: #fff;
  padding: 6px;
  border-radius: 6px;
  border: 1px solid rgba(15, 23, 42, 0.03);
}
.mf {
  font-weight: 600;
  width: 120px;
}
.mv {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  padding: 4px 6px;
  border-radius: 4px;
}
.mv.old {
  background: #fff7ed;
  color: #92400e;
}
.mv.new {
  background: #ecfdf5;
  color: #064e3b;
}
.marr {
  color: #6b7280;
}
.card-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  min-width: 120px;
}
.change-hints .hint {
  background: #f3f4f6;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 0.8rem;
  margin-left: 6px;
}
.change-hints .deprecated {
  background: #fff1f2;
  color: #b91c1c;
}
.card-actions button {
  margin-left: 6px;
}
.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin: 12px 0;
}
.detail-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.detail-path {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  color: #0f1724;
}
.detail-summary {
  color: #6b7280;
}
.detail-body {
  margin-top: 12px;
}
.fields-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr 40px 1fr;
  gap: 8px;
  align-items: center;
  padding: 6px;
  background: #fff;
  border-radius: 6px;
  border: 1px solid rgba(15, 23, 42, 0.03);
}

.change-header {
  gap: 12px;
}
.field-name {
  font-weight: 600;
}
.field-old code,
.field-new code {
  background: #0f1724;
  color: #d1fae5;
  padding: 6px;
  border-radius: 6px;
  display: block;
}
.json-preview {
  background: #0b1220;
  color: #d1fae5;
  padding: 12px;
  border-radius: 8px;
  overflow: auto;
  max-height: 320px;
}
.endpoint-details {
  display: flex;
  flex-direction: column;
  gap: 28px;
  margin-top: 16px;
}

.detail-section {
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  padding: 16px;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
  transition: all 0.2s ease;
}

.detail-section:hover {
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}

.detail-section.no-hover:hover {
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
  transform: none;
}

.detail-section h6 {
  margin: 0 0 12px 0;
  font-size: 1rem;
  color: #0f1724;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-section h6::before {
  content: "";
  width: 4px;
  height: 16px;
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  border-radius: 2px;
}

.parameters-section {
  padding-left: 0;
  padding-right: 0;
}

.parameters-section h6 {
  padding-left: 16px;
}

.parameters-table {
  margin: 0;
  width: 100%;
}

.parameters-table .p-datatable {
  border: none;
  background: transparent;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.1);
  width: 100%;
}

.parameters-table .p-datatable thead th {
  background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
  border: none;
  padding: 12px 8px;
  font-weight: 600;
  color: #f1f5f9;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.parameters-table .p-datatable tbody td {
  border: none;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  padding: 10px 8px;
  font-size: 0.85rem;
  background: #ffffff;
}

.parameters-table .p-datatable tbody tr:nth-child(even) {
  background: #f8fafc;
}

.parameters-table .p-datatable tbody tr:hover {
  background: #e2e8f0;
  transition: background-color 0.2s ease;
}

.parameters-table code {
  background: #1e293b;
  color: #e2e8f0;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.8rem;
}

.content-list,
.response-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.content-item {
  background: linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%);
  padding: 12px;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
  transition: all 0.2s ease;
}

.content-item:hover {
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.12);
  transform: translateY(-1px);
}

.content-item h6 {
  margin: 0 0 10px 0;
  font-size: 0.95rem;
  color: #0f1724;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}

.content-item h6::before {
  content: "📄";
  font-size: 0.9rem;
}

.schema-preview,
.example-preview {
  margin-top: 8px;
}

.schema-preview .mini-json,
.example-preview .mini-json {
  max-height: 150px;
}

.schema-ref {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #0c4a6e;
  font-weight: 500;
  font-size: 0.85rem;
}

.schema-ref i {
  color: #0ea5e9;
}

.schema-properties {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}

.property-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.06);
  font-size: 0.85rem;
  flex-wrap: wrap;
}

.prop-name {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  font-weight: 600;
  color: #0f1724;
  background: #1e293b;
  color: #e2e8f0;
  padding: 2px 6px;
  border-radius: 4px;
}

.prop-type {
  color: #3b82f6;
  font-weight: 500;
}

.prop-desc {
  color: #6b7280;
  font-style: italic;
}

.body-desc {
  color: #374151;
  font-size: 0.9rem;
  margin-bottom: 8px;
}

.json-toggle {
  display: flex;
  justify-content: center;
  margin: 12px 0;
}

.response-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.response-desc {
  color: #374151;
  font-size: 0.9rem;
}

.responses-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.schema-title {
  font-weight: bold;
  margin-bottom: 8px;
  font-size: 1rem;
  color: #0f1724;
}
.schema-type {
  font-size: 0.9rem;
  color: #6b7280;
  margin-bottom: 4px;
}
.required-list {
  font-size: 0.9rem;
  color: #dc2626;
  margin-bottom: 8px;
}
.properties-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.prop-title {
  color: #059669;
  font-weight: 500;
  font-size: 0.8rem;
  margin-left: auto;
}

.schema-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.schema-header > div {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 12px;
}

.schema-name {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  font-weight: 600;
  color: #0f1724;
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9rem;
}

.change-type-tag {
  margin-left: auto;
}

.schema-overview {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.schema-type {
  font-size: 0.85rem;
  color: #475569;
}

.schema-desc {
  font-size: 0.85rem;
  color: #64748b;
  font-style: italic;
  padding-top: 2px;
}

.schema-changes {
  margin-top: 8px;
}

.change-summary {
  display: flex;
  gap: 12px;
  font-size: 0.8rem;
}

.change-added {
  color: #10b981;
  font-weight: 500;
}

.change-removed {
  color: #ef4444;
  font-weight: 500;
}

.change-modified {
  color: #f59e0b;
  font-weight: 500;
}

.schema-properties {
  margin-top: 12px;
  border-top: 1px solid rgba(15, 23, 42, 0.06);
  padding-top: 8px;
}

.expand-btn {
  margin-right: 8px;
}

.properties-count {
  font-size: 0.8rem;
  color: #64748b;
}

.properties-list {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 200px;
  overflow-y: auto;
  transition: all 0.3s ease;
}

.property-item {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  background: #f8fafc;
  font-size: 0.8rem;
  transition: background-color 0.2s ease;
}

.prop-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.prop-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.prop-name {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  font-weight: 600;
  color: #0f1724;
  background: #e2e8f0;
  padding: 2px 4px;
  border-radius: 3px;
  text-align: left;
}

.prop-type {
  color: #3b82f6;
  font-weight: 500;
}

.change-indicator {
  margin-left: auto;
  font-weight: bold;
  font-size: 0.9rem;
}

.prop-added {
  background: #ecfdf5;
  border-left: 3px solid #10b981;
}

.prop-removed {
  background: #fef2f2;
  border-left: 3px solid #ef4444;
}

.prop-modified {
  background: #fffbeb;
  border-left: 3px solid #f59e0b;
}

.schema-changes-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.change-group h6 {
  margin: 0 0 8px 0;
  font-size: 0.9rem;
  color: #0f1724;
  font-weight: 600;
}

.change-group ul {
  margin: 0;
  padding-left: 20px;
}

.change-group li {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  font-size: 0.85rem;
  color: #475569;
}

.change-value {
  display: flex;
  align-items: center;
  gap: 8px;
}

.change-value.added code {
  background: #ecfdf5;
  color: #064e3b;
}

.change-value.removed code {
  background: #fef2f2;
  color: #b91c1c;
}

.change-value.modified {
  display: flex;
  align-items: center;
  gap: 8px;
}

.diff-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.old {
  background: #f8fafc;
  color: #0f1724;
  padding: 4px 6px;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  font-size: 0.85rem;
}

.new {
  background: #ecfdf5;
  color: #064e3b;
  padding: 4px 6px;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  font-size: 0.85rem;
}

.arrow {
  color: #6b7280;
  font-weight: bold;
  font-size: 0.9rem;
}

.label {
  font-weight: 600;
  color: #6b7280;
  font-size: 0.8rem;
}

.change-value code {
  padding: 4px 6px;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  font-size: 0.85rem;
}

.strikethrough {
  text-decoration: line-through;
  color: #b91c1c;
}

.before-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}

.expand-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background-color 0.2s ease;
  font-size: 0.85rem;
  color: #6b7280;
  font-weight: 600;
}

.expand-btn:hover {
  background-color: rgba(107, 114, 128, 0.1);
}

.before-content {
  margin-left: 16px;
  margin-top: 4px;
  animation: slideDown 0.3s ease;
}

.before-only {
  background: #f8fafc;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.03);
}

.before-value code {
  background: #0b1220;
  color: #d1fae5;
  padding: 8px;
  border-radius: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  font-size: 0.78rem;
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.info-change {
  background: #f8fafc;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.03);
  display: flex;
  align-items: center;
  gap: 12px;
}

@keyframes slideDown {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 500px;
  }
}

@media (max-width: 900px) {
  .cards-grid {
    grid-template-columns: 1fr;
  }
  .summary-grid {
    grid-template-columns: 1fr;
  }
  .endpoint-card {
    flex-direction: column;
    align-items: center;
  }
  .schema-card {
    flex-direction: column;
    align-items: center;
  }
  .card-right {
    align-items: flex-start;
  }
}

.mini-label {
  min-width: 56px;
}

.header-left-label {
  margin-right: 12px;
  font-weight: bold;
  font-size: 1.1rem;
  color: inherit;
}
</style>

