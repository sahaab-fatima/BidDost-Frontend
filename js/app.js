(function () {
  var cfg = window.BIDDOST_CONFIG || {};
  var supabase = window.supabase.createClient(cfg.url || "https://PLACEHOLDER.supabase.co", cfg.anonKey || "PLACEHOLDER");
  var B = (window.BIDDOST = {});
  B.supabase = supabase;
  B.cfg = cfg;

  B.rel = function (p) { return (cfg.basePath || "/") + p; };
  B.go = function (p) { window.location.href = B.rel(p); };

  B.user = function () { return supabase.auth.getUser().then(function (r) { return (r.data && r.data.user) || null; }); };

  B.guard = function (mode) {
    B.user().then(function (u) {
      if (mode === "auth" && !u) B.go("login.html");
      if (mode === "guest" && u) B.go("company-setup.html");
    });
  };

  B.setBusy = function (btn, busy) {
    if (!btn) return;
    btn.disabled = !!busy;
    btn.classList.toggle("loading", !!busy);
  };

  B.alert = function (id, type, msg) {
    var el = document.getElementById(id);
    if (!el) return;
    el.className = "alert show " + (type || "info");
    el.textContent = msg || "";
  };
  B.hideAlert = function (id) {
    var el = document.getElementById(id);
    if (el) el.className = "alert";
  };

  B.busyWrap = function (fn) {
    return function () {
      var btn = this.querySelector(".btn") || this;
      B.setBusy(btn, true);
      B.hideAlert("form-alert");
      fn.apply(this, arguments).catch(function (e) {
        B.setBusy(btn, false);
        B.alert("form-alert", "danger", e && e.message ? e.message : "Something went wrong.");
      });
    };
  };

  /* ---------- Password strength ---------- */
  B.pwStrength = function (v) {
    var s = 0;
    if (v.length >= 8) s++;
    if (v.length >= 12) s++;
    if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
    if (/\d/.test(v)) s++;
    if (/[^A-Za-z0-9]/.test(v)) s++;
    return s;
  };

  /* ---------- Auth actions ---------- */
  B.signUp = function (fullName, email, password) {
    return supabase.auth.signUp({
      email: email,
      password: password,
      options: { data: { full_name: fullName } }
    });
  };

  B.signIn = function (email, password) {
    return supabase.auth.signInWithPassword({ email: email, password: password });
  };

  B.signOut = function () {
    return supabase.auth.signOut();
  };

  B.sendReset = function (email) {
    return supabase.auth.resetPasswordForEmail(email, { redirectTo: cfg.resetRedirect });
  };

  B.updatePassword = function (password) {
    return supabase.auth.updateUser({ password: password });
  };

  /* ---------- Profile / data actions ---------- */
  B.getCompany = function (userId) {
    return supabase.from("companies").select("*").eq("user_id", userId).maybeSingle();
  };

  B.saveCompany = function (userId, payload) {
    return supabase.from("companies").upsert({ user_id: userId, ...payload }, { onConflict: "user_id" });
  };

  B.listCapabilities = function (companyId) {
    return supabase.from("company_capabilities").select("*").eq("company_id", companyId).order("created_at", { ascending: true });
  };

  B.addCapability = function (companyId, cap) {
    return supabase.from("company_capabilities").insert({ company_id: companyId, ...cap });
  };

  B.removeCapability = function (id) {
    return supabase.from("company_capabilities").delete().eq("id", id);
  };

  B.listCertificates = function (companyId) {
    return supabase.from("company_certificates").select("*").eq("company_id", companyId).order("expiry_date", { ascending: true });
  };

  B.addCertificate = function (companyId, cert) {
    return supabase.from("company_certificates").insert({ company_id: companyId, ...cert });
  };

  B.removeCertificate = function (id) {
    return supabase.from("company_certificates").delete().eq("id", id);
  };

  B.updateCompany = function (userId, payload) {
    return supabase.from("companies").update(payload).eq("user_id", userId);
  };

  B.updateCapability = function (id, cap) {
    return supabase.from("company_capabilities").update(cap).eq("id", id);
  };

  B.updateCertificate = function (id, cert) {
    return supabase.from("company_certificates").update(cert).eq("id", id);
  };

  B.getStorageUrl = function (path) {
    var cleanPath = path.replace(/^tender-pdfs\//, "");
    return supabase.storage.from("tender-pdfs").getPublicUrl(cleanPath);
  };

  B.completeOnboarding = function (companyId) {
    return supabase.from("companies").update({ onboarding_complete: true }).eq("id", companyId);
  };

  /* ---------- Tender actions ---------- */
  B.listTenders = function (filters) {
    var q = supabase.from("tenders").select("*").order("deadline", { ascending: true });
    if (filters) {
      if (filters.uploadedBy) q = q.eq("uploaded_by", filters.uploadedBy);
      if (filters.level) q = q.eq("level", filters.level);
      if (filters.status) q = q.eq("status", filters.status);
      if (filters.category) q = q.eq("category", filters.category);
      if (filters.minMatch) q = q.gte("match_score", Number(filters.minMatch));
      if (filters.search) q = q.or("title.ilike.%" + filters.search + "%,reference.ilike.%" + filters.search + "%,organisation.ilike.%" + filters.search + "%");
    }
    return q;
  };

  B.getTender = function (id) {
    return supabase.from("tenders").select("*").eq("id", id).maybeSingle();
  };

  B.saveTender = function (companyId, tenderId, decision, note) {
    return supabase.from("saved_tenders").upsert({
      company_id: companyId,
      tender_id: tenderId,
      team_decision: decision || null,
      team_note: note || null
    }, { onConflict: "company_id,tender_id" });
  };

  B.unsaveTender = function (companyId, tenderId) {
    return supabase.from("saved_tenders").delete()
      .eq("company_id", companyId)
      .eq("tender_id", tenderId);
  };

  B.listSavedTenders = function (companyId) {
    return supabase.from("saved_tenders").select("*, tender:tenders(*)").eq("company_id", companyId);
  };

  B.updateSavedDecision = function (id, decision, note) {
    return supabase.from("saved_tenders").update({ team_decision: decision, team_note: note }).eq("id", id);
  };

  /* ---------- Bid decision ---------- */
  B.computeDecisionScore = function (tender, eligibility, caps, certs) {
    var factors = [];
    var totalWeight = 0, weightedSum = 0;

    // 1. Relevance / Match score (35%)
    var matchScore = tender.match_score;
    if (matchScore == null) {
      // Compute basic match from capabilities vs tender
      var matchParts = [];
      if (tender.category) {
        var catHit = caps.some(function (c) { return c.category === tender.category; });
        matchParts.push(catHit ? 40 : 0);
      } else {
        matchParts.push(20);
      }
      if (tender.value_pkr && caps.length) {
        var maxVal = caps.reduce(function (m, c) { return Math.max(m, c.max_value || 0); }, 0);
        matchParts.push(maxVal >= tender.value_pkr ? 30 : maxVal > 0 ? 15 : 10);
      } else {
        matchParts.push(15);
      }
      var expParts = caps.map(function (c) { return c.years_experience || 0; });
      var maxExp = expParts.length ? Math.max.apply(null, expParts) : 0;
      matchParts.push(maxExp >= 5 ? 30 : maxExp >= 2 ? 20 : 10);
      matchScore = Math.min(100, matchParts.reduce(function (a, b) { return a + b; }, 0));
    }
    var matchPts = matchScore;
    factors.push({ label: "Company Match", weight: 35, score: matchPts, maxScore: 100, status: matchPts >= 70 ? "pass" : matchPts >= 40 ? "review" : "fail", detail: "AI match score: " + matchScore + "%" });
    totalWeight += 35; weightedSum += 35 * (matchPts / 100);

    // 2. Eligibility (30%)
    var eligScore = 0;
    var eligCriteria = (eligibility && eligibility.criteria) || [];
    if (eligCriteria.length) {
      eligScore = Math.round(((eligibility.passCount || 0) / eligCriteria.length) * 100);
    }
    factors.push({ label: "Eligibility", weight: 30, score: eligScore, maxScore: 100, status: eligScore >= 80 ? "pass" : eligScore >= 50 ? "review" : "fail", detail: eligCriteria.length ? (eligibility.passCount || 0) + "/" + eligCriteria.length + " criteria passing" : "Not checked" });
    totalWeight += 30; weightedSum += 30 * (eligScore / 100);

    // 3. Resource effort (20%) — based on value vs capability
    var valueScore = 50; // default neutral
    if (tender.value_pkr && caps && caps.length) {
      var maxValue = caps.reduce(function (m, c) { return Math.max(m, c.max_value || 0); }, 0);
      if (maxValue > 0) {
        var ratio = tender.value_pkr / maxValue;
        valueScore = ratio <= 1 ? Math.max(30, 100 - Math.round(ratio * 60)) : Math.max(10, 50 - Math.round((ratio - 1) * 40));
      }
    }
    factors.push({ label: "Resource Effort", weight: 20, score: valueScore, maxScore: 100, status: valueScore >= 60 ? "pass" : valueScore >= 30 ? "review" : "fail", detail: "Value vs capability: " + valueScore + "%" });
    totalWeight += 20; weightedSum += 20 * (valueScore / 100);

    // 4. Risk (15%)
    var risks = (tender.ai_summary && tender.ai_summary.risk_flags) || [];
    var riskScore = Math.max(20, 100 - (risks.length * 20));
    factors.push({ label: "Risk", weight: 15, score: riskScore, maxScore: 100, status: riskScore >= 70 ? "pass" : riskScore >= 40 ? "review" : "fail", detail: risks.length + " risk flag(s) identified" });
    totalWeight += 15; weightedSum += 15 * (riskScore / 100);

    var overall = totalWeight > 0 ? Math.round(weightedSum / totalWeight * 100) : 0;
    var recommendation = overall >= 70 ? "BID" : overall >= 50 ? "CONDITIONAL" : overall >= 30 ? "HOLD" : "NO-BID";

    return {
      overall: overall,
      recommendation: recommendation,
      factors: factors,
      risks: risks,
      missingRecords: eligCriteria.filter(function (c) { return c.status === "unclear"; })
    };
  };

  B.saveDecision = function (companyId, tenderId, decisionData) {
    return supabase.from("saved_tenders").upsert({
      company_id: companyId,
      tender_id: tenderId,
      team_decision: decisionData.decision,
      team_note: decisionData.comment,
      decision_data: decisionData
    }, { onConflict: "company_id,tender_id" });
  };

  B.getDecision = function (companyId, tenderId) {
    return supabase.from("saved_tenders").select("*").eq("company_id", companyId).eq("tender_id", tenderId).maybeSingle();
  };

  B.decisionLabel = function (decision) {
    if (decision === "Bid") return { cls: "lbl pass", label: "✓ Bid" };
    if (decision === "No-Bid") return { cls: "lbl fail", label: "✗ No-Bid" };
    if (decision === "Hold") return { cls: "lbl review", label: "⏸ Hold" };
    if (decision === "Need More Info") return { cls: "lbl brand", label: "? Need More Info" };
    return { cls: "lbl gray", label: "Not decided" };
  };

  B.deadlineCountdown = function (dateStr) {
    if (!dateStr) return { label: "No deadline", cls: "lbl gray", days: null };
    var d = new Date(dateStr + "T23:59:59");
    var now = new Date();
    var days = Math.ceil((d - now) / 86400000);
    if (days < 0) return { label: "Passed", cls: "lbl fail", days: days };
    if (days === 0) return { label: "Today!", cls: "lbl fail", days: 0 };
    if (days <= 3) return { label: days + "d left", cls: "lbl fail", days: days };
    if (days <= 7) return { label: days + "d left", cls: "lbl review", days: days };
    return { label: days + "d left", cls: "lbl pass", days: days };
  };

  B.matchBadge = function (score) {
    if (score == null) return { cls: "lbl gray", label: "Pending" };
    if (score >= 70) return { cls: "match-hi", label: score + "%" };
    if (score >= 40) return { cls: "match-mid", label: score + "%" };
    return { cls: "match-low", label: score + "%" };
  };

  /* ---------- Tender upload ---------- */
  B.uploadTenderFile = function (file, onProgress) {
    var path = Date.now() + "-" + file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    return supabase.storage.from("tender-pdfs").upload(path, file, {
      contentType: file.type || "application/pdf",
      upsert: false
    }).then(function (res) {
      if (res.error) throw new Error(res.error.message || JSON.stringify(res.error));
      return "tender-pdfs/" + path;
    });
  };

  B.checkDuplicateTender = function (title, reference) {
    var q = supabase.from("tenders").select("id, title, reference, status");
    if (reference) {
      q = q.eq("reference", reference);
    } else if (title) {
      q = q.ilike("title", "%" + title + "%");
    }
    return q.limit(5);
  };

  B.createTender = function (data) {
    return supabase.from("tenders").insert(data).select().maybeSingle();
  };

  B.updateTender = function (id, data) {
    return supabase.from("tenders").update({ ...data, updated_at: new Date().toISOString() }).eq("id", id);
  };

  B.updateTenderStatus = function (id, status) {
    return supabase.from("tenders").update({ status: status, updated_at: new Date().toISOString() }).eq("id", id);
  };

  B.retryTender = function (id) {
    return supabase.from("tenders").update({ status: "New", updated_at: new Date().toISOString() }).eq("id", id);
  };

  B.listMyUploads = function (userId) {
    return supabase.from("tenders").select("*").eq("uploaded_by", userId).order("created_at", { ascending: false });
  };

  /* ---------- Eligibility check ---------- */
  B.runEligibilityCheck = function (tenderId, companyId) {
    return Promise.all([
      supabase.from("tenders").select("*").eq("id", tenderId).maybeSingle(),
      supabase.from("company_capabilities").select("*").eq("company_id", companyId),
      supabase.from("company_certificates").select("*").eq("company_id", companyId),
       supabase.from("companies").select("*").eq("id", companyId).maybeSingle()
    ]).then(function (results) {
      var tender = results[0].data;
      var caps = results[1].data || [];
      var certs = results[2].data || [];
      var company = results[3].data;
      if (!tender || !company) return { error: { message: "Tender or company not found" } };

      var summary = tender.ai_summary || {};
      var criteria = [];
      var passCount = 0, failCount = 0, unclearCount = 0;

      // Check category match
      var tenderCat = tender.category;
      var catMatch = !tenderCat || tenderCat === "Any" || caps.some(function (c) { return c.category === tenderCat; });
      criteria.push({
        id: "cat-match",
        requirement: "Category match: " + (tender.category || "Any"),
        status: catMatch ? "pass" : "fail",
        source: "AI extraction",
        evidence: "Company capabilities include " + tender.category,
        profile_value: caps.map(function (c) { return c.category; }).join(", ") || "None",
        override: null
      });
      if (catMatch) passCount++; else failCount++;

      // Check experience
      var reqExp = summary.min_experience || 5;
      var maxExp = caps.reduce(function (max, c) { return Math.max(max, c.years_experience || 0); }, 0);
      criteria.push({
        id: "experience",
        requirement: "Minimum " + reqExp + " years experience",
        status: maxExp >= reqExp ? "pass" : "fail",
        source: "Tender clause",
        evidence: "Requirement: " + reqExp + " years",
        profile_value: maxExp + " years (max from capabilities)",
        override: null
      });
      if (maxExp >= reqExp) passCount++; else failCount++;

      // Check turnover
      var reqTurnover = summary.min_turnover || null;
      if (reqTurnover) {
        criteria.push({
          id: "turnover",
          requirement: "Annual turnover ≥ PKR " + Number(reqTurnover).toLocaleString(),
          status: "unclear",
          source: "Tender clause",
          evidence: "Turnover requirement found in tender document",
          profile_value: "Not in profile — upload audited accounts",
          override: null
        });
        unclearCount++;
      }

      // Check PEC registration
      var hasPEC = certs.some(function (c) { return c.type === "PEC Registration"; });
      criteria.push({
        id: "pec",
        requirement: "Valid PEC registration",
        status: hasPEC ? "pass" : "fail",
        source: "Tender clause",
        evidence: "Contractor shall hold valid PEC registration",
        profile_value: hasPEC ? certs.find(function (c) { return c.type === "PEC Registration"; }).type + " (valid)" : "Not found in vault",
        override: null
      });
      if (hasPEC) passCount++; else failCount++;

      // Check bid security
      if (tender.bid_security_pct && tender.value_pkr) {
        var reqBond = tender.value_pkr * (tender.bid_security_pct / 100);
        criteria.push({
          id: "bid-security",
          requirement: "Bid security " + tender.bid_security_pct + "% (PKR " + Number(reqBond).toLocaleString() + ")",
          status: "unclear",
          source: "Tender clause",
          evidence: "Accompanied by bid security of " + tender.bid_security_pct + "%",
          profile_value: "Bank limit not in profile",
          override: null
        });
        unclearCount++;
      }

      // Check certificates
      var requiredDocs = summary.required_documents || ["PEC Registration", "Tax returns"];
      requiredDocs.forEach(function (doc) {
        if (doc === "PEC Registration") return; // already checked
        var found = certs.some(function (c) { return c.type && c.type.toLowerCase().indexOf(doc.toLowerCase()) !== -1; });
        criteria.push({
          id: "doc-" + doc.replace(/\s+/g, "-").toLowerCase(),
          requirement: doc,
          status: found ? "pass" : "unclear",
          source: "Tender clause",
          evidence: "Required document listed in tender",
          profile_value: found ? "Found in vault" : "Not found — upload evidence",
          override: null
        });
        if (found) passCount++; else unclearCount++;
      });

      // Determine verdict
      var verdict = "ELIGIBLE";
      var verdictCls = "pass";
      if (failCount > 0 && unclearCount > 0) { verdict = "CONDITIONAL"; verdictCls = "review"; }
      else if (failCount > 0) { verdict = "INELIGIBLE"; verdictCls = "fail"; }
      else if (unclearCount > 0) { verdict = "CONDITIONAL"; verdictCls = "review"; }

      // Compute match_score if not set
      var matchScore = tender.match_score;
      if (matchScore == null) {
        var parts = [];
        if (tender.category) {
          parts.push(caps.some(function (c) { return c.category === tender.category; }) ? 40 : 0);
        } else { parts.push(20); }
        if (tender.value_pkr && caps.length) {
          var maxV = caps.reduce(function (m, c) { return Math.max(m, c.max_value || 0); }, 0);
          parts.push(maxV >= tender.value_pkr ? 30 : maxV > 0 ? 15 : 10);
        } else { parts.push(15); }
        var maxE = caps.reduce(function (m, c) { return Math.max(m, c.years_experience || 0); }, 0);
        parts.push(maxE >= 5 ? 30 : maxE >= 2 ? 20 : 10);
        matchScore = Math.min(100, parts.reduce(function (a, b) { return a + b; }, 0));
      }

      var result = {
        verdict: verdict,
        verdictCls: verdictCls,
        passCount: passCount,
        failCount: failCount,
        unclearCount: unclearCount,
        criteria: criteria
      };

      // Save to database (including match_score)
      var updateData = { eligibility_data: result, updated_at: new Date().toISOString() };
      if (tender.match_score == null) updateData.match_score = matchScore;
      return supabase.from("tenders").update(updateData).eq("id", tenderId).then(function () {
        result.match_score = matchScore;
        return { data: result };
      });
    });
  };

  B.getEligibility = function (tenderId) {
    return supabase.from("tenders").select("eligibility_data").eq("id", tenderId).maybeSingle();
  };

  B.overrideEligibility = function (tenderId, criteriaId, newStatus) {
    return supabase.from("tenders").select("eligibility_data").eq("id", tenderId).maybeSingle().then(function (res) {
      if (res.error || !res.data) return res;
      var data = res.data.eligibility_data || {};
      var criteria = data.criteria || [];
      var c = criteria.find(function (c) { return c.id === criteriaId; });
      if (c) {
        c.override = newStatus;
        c.status = newStatus;
      }
      return supabase.from("tenders").update({ eligibility_data: data, updated_at: new Date().toISOString() }).eq("id", tenderId);
    });
  };

  B.verdictLabel = function (verdict) {
    if (verdict === "ELIGIBLE") return { cls: "lbl pass", label: "✓ ELIGIBLE" };
    if (verdict === "CONDITIONAL") return { cls: "lbl review", label: "⚠ CONDITIONAL" };
    return { cls: "lbl fail", label: "✗ INELIGIBLE" };
  };

  /* ---------- Document upload to storage ---------- */
  B.uploadDocument = function (file) {
    var path = "company-docs/" + Date.now() + "-" + file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    return supabase.storage.from("documents").upload(path, file).then(function (res) {
      if (res.error) throw res.error;
      return path;
    });
  };

  /* ---------- Expiry status helper ---------- */
  B.expiryStatus = function (dateStr) {
    if (!dateStr) return { label: "No expiry", cls: "lbl gray" };
    var d = new Date(dateStr + "T23:59:59");
    var now = new Date();
    var days = Math.ceil((d - now) / 86400000);
    if (days < 0) return { label: "Expired", cls: "lbl fail" };
    if (days <= 90) return { label: "Expires in " + days + "d", cls: "lbl review" };
    return { label: "Valid", cls: "lbl pass" };
  };

  /* ---------- AI extraction via Edge Function ---------- */
  B.createTenderFile = function (tenderId, filePath, pageCount) {
    return supabase.from("tender_files").insert({
      tender_id: tenderId,
      file_url: filePath || "",
      page_count: pageCount || 0,
      created_at: new Date().toISOString()
    }).select().maybeSingle();
  };

  B.createTenderPages = function (fileId, pages) {
    var now = new Date().toISOString();
    var rows = pages.map(function (p) {
      return { file_id: fileId, page_number: p.page_number, text: p.text, language: "en", created_at: now };
    });
    return supabase.from("tender_pages").insert(rows);
  };

  B.callExtractTender = function (tenderId) {
    var fnUrl = cfg.url + "/functions/v1/extract-tender";
    return fetch(fnUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + cfg.anonKey,
      },
      body: JSON.stringify({ tender_id: tenderId }),
    }).then(function (res) { return res.json(); });
  };

  /* ---------- PDF text extraction (uses pdf.js) ---------- */
  B.extractPdfPages = function (file) {
    return new Promise(function (resolve, reject) {
      if (typeof pdfjsLib === "undefined") {
        reject(new Error("pdf.js not loaded"));
        return;
      }
      var reader = new FileReader();
      reader.onload = function (e) {
        var typedArray = new Uint8Array(e.target.result);
        pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        pdfjsLib.getDocument(typedArray).promise.then(function (pdf) {
          var pages = [];
          var tasks = [];
          var totalPages = Math.min(pdf.numPages, 30);
          for (var i = 1; i <= totalPages; i++) {
            tasks.push(
              pdf.getPage(i).then(function (page) {
                return page.getTextContent().then(function (content) {
                  var text = content.items.map(function (item) { return item.str; }).join(" ");
                  pages.push({ page_number: page.pageNumber, text: text });
                });
              })
            );
          }
          Promise.all(tasks).then(function () {
            pages.sort(function (a, b) { return a.page_number - b.page_number; });
            resolve(pages);
          }).catch(reject);
        }).catch(reject);
      };
      reader.onerror = function () { reject(new Error("Failed to read file")); };
      reader.readAsArrayBuffer(file);
    });
  };

  B.escape = function (s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  };
})();
