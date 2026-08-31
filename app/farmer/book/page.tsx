"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FarmerTopBar from "@/components/FarmerTopBar";
import FarmerNav from "@/components/FarmerNav";
import ProgressSteps from "@/components/ProgressSteps";
import LoadIndicator from "@/components/LoadIndicator";
import { formatDate, formatDateShort } from "@/lib/format";
import {
  ChevronLeft,
  Wheat,
  CheckCircle2,
  Clock3,
  MapPin,
  Calendar,
  Layers,
  CalendarCheck,
  AlertCircle,
} from "lucide-react";

import { useLanguage } from "@/lib/i18n/context";

type Crop = { id: string; name: string; code: string };
type Centre = {
  id: string;
  name: string;
  code: string;
  district: string;
  distanceKm: number;
  totalCapacity: number;
  availableCapacity: number;
  waiting: number;
  load: "LOW_LOAD" | "NORMAL" | "BUSY" | "HIGH_LOAD";
  estimatedWaitMins: number;
  reason?: string;
};
type Slot = {
  id: string;
  startTime: string;
  endTime: string;
  capacity: number;
  remaining: number;
  isFull: boolean;
};
type DateOption = {
  date: string;
  dayName: string;
  dayNumber: number;
  monthName: string;
  year: number;
  isToday: boolean;
  isAvailable: boolean;
  status: string;
};

export default function BookSlotPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [step, setStep] = useState(1);

  const STEP_TITLES = [
    t("selectDateStep"),
    t("selectCropStep"),
    t("selectCentreStep"),
    t("selectSlotStep"),
    t("enterQuantityStep"),
    t("reviewBookingStep"),
  ];

  const [validDates, setValidDates] = useState<DateOption[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [centres, setCentres] = useState<Centre[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [recommended, setRecommended] = useState<Centre | null>(null);
  const [sortBy, setSortBy] = useState<"queue" | "wait" | "capacity">("queue");

  const [date, setDate] = useState("");
  const [cropCode, setCropCode] = useState("");
  const [centreId, setCentreId] = useState("");
  const [slotId, setSlotId] = useState("");
  const [quantity, setQuantity] = useState("");

  const [activeCount, setActiveCount] = useState(0);
  const [maxLimit, setMaxLimit] = useState(3);
  const [isMaxReached, setIsMaxReached] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    token: string;
    date: string;
    slot: string;
    centreName: string;
  } | null>(null);

  // Initial load of dates, crops, and active token count
  async function loadInitial() {
    setLoading(true);
    try {
      const [optRes, curRes] = await Promise.all([
        fetch("/api/farmer/booking-options"),
        fetch("/api/farmer/current"),
      ]);

      if (curRes.ok) {
        const curData = await curRes.json();
        setActiveCount(curData.activeCount ?? 0);
        setMaxLimit(curData.maxLimit ?? 3);
        setIsMaxReached(Boolean(curData.isMaxReached));
      }

      if (optRes.ok) {
        const data = await optRes.json();
        setValidDates(data.validDates || []);
        setCrops(data.crops || []);
        if (!date && data.today) {
          setDate(data.today);
        }
      }
    } catch {
      setError("Unable to load booking options. Please refresh.");
    } finally {
      setLoading(false);
    }
  }


  // Load centres whenever date or crop changes
  async function loadCentres(selectedDate: string) {
    try {
      const params = new URLSearchParams({ date: selectedDate });
      const res = await fetch(`/api/farmer/booking-options?${params}`);
      const data = await res.json();
      setCentres(data.centres || []);
      setRecommended(data.recommended || null);
    } catch {
      setError("Unable to load available centres for this date.");
    }
  }

  // Load slots whenever centre and date are selected
  async function loadSlots(selectedCentreId: string, selectedDate: string) {
    setLoadingSlots(true);
    try {
      const params = new URLSearchParams({
        date: selectedDate,
        centreId: selectedCentreId,
      });
      const res = await fetch(`/api/farmer/booking-options?${params}`);
      const data = await res.json();
      setSlots(data.slots || []);
    } catch {
      setError("Unable to load available time slots.");
    } finally {
      setLoadingSlots(false);
    }
  }

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    if (date) {
      loadCentres(date);
    }
  }, [date]);

  useEffect(() => {
    if (date && centreId) {
      loadSlots(centreId, date);
    }
  }, [date, centreId]);

  const sortedCentres = [...centres].sort((a, b) => {
    if (sortBy === "queue") return a.waiting - b.waiting;
    if (sortBy === "wait") return a.estimatedWaitMins - b.estimatedWaitMins;
    return b.availableCapacity - a.availableCapacity;
  });

  const selectedCrop = crops.find((c) => c.code === cropCode);
  const selectedCentre = centres.find((c) => c.id === centreId);
  const selectedSlot = slots.find((s) => s.id === slotId);

  function handleBack() {
    setError("");
    if (step > 1) {
      setStep((s) => s - 1);
    } else {
      router.push("/farmer");
    }
  }

  async function confirmBooking() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/farmer/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cropCode,
          quantityQuintal: Number(quantity),
          centreId,
          date,
          slotId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to confirm your booking. Please try again.");
        return;
      }
      setResult({
        token: data.token,
        date,
        slot: selectedSlot ? `${selectedSlot.startTime} – ${selectedSlot.endTime}` : "",
        centreName: selectedCentre?.name || "",
      });
    } catch {
      setError("Unable to confirm your booking. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <main className="min-h-screen pb-24 bg-surface flex items-center">
        <div className="max-w-lg mx-auto px-4 w-full">
          <div className="panel text-center py-10 px-6 animate-rise-in">
            <span className="w-14 h-14 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={28} />
            </span>
            <p className="font-display font-bold text-xl text-ink">Booking Confirmed</p>
            <p className="text-xs text-ink-faint mt-1 uppercase tracking-wide">Your Digital Token</p>
            <p className="font-display text-5xl font-extrabold text-grain my-3 tnum">{result.token}</p>
            
            <div className="bg-surface-sunken rounded-lg p-3 my-4 text-xs text-ink-soft text-left space-y-1.5 border border-line">
              <p><span className="text-ink-faint">Date:</span> <strong className="text-ink">{formatDate(result.date)}</strong></p>
              <p><span className="text-ink-faint">Slot:</span> <strong className="text-ink">{result.slot}</strong></p>
              <p><span className="text-ink-faint">Centre:</span> <strong className="text-ink">{result.centreName}</strong></p>
            </div>

            <p className="text-xs text-ink-faint mb-6">
              Your appointment is recorded in the live queue. Please arrive during your time slot.
            </p>

            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => router.push("/farmer/queue")}>
                View Live Queue
              </button>
              <button className="btn-primary flex-1" onClick={() => router.push("/farmer")}>
                Go to Home
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-24 bg-surface">
      <FarmerTopBar name="Farmer" title="Book Procurement Slot" onBack={handleBack} />
      <div className="max-w-lg mx-auto px-4 py-4">
        {/* Step Navigation Bar */}
        <div className="mb-5 space-y-2">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700 py-1 pr-2 -ml-1 rounded-md transition-colors"
              aria-label="Back"
            >
              <ChevronLeft size={18} />
              <span>Back</span>
            </button>
            <p className="text-xs text-ink-faint font-medium">
              Step {step} of 6 · {STEP_TITLES[step - 1]}
            </p>
          </div>
          <ProgressSteps total={6} current={step} />
        </div>

        {error && <p className="text-sm text-error bg-error/5 rounded-lg px-3 py-2 mb-4">{error}</p>}

        {/* MAXIMUM 3 TOKENS REACHED BLOCKER */}
        {isMaxReached ? (
          <div className="panel p-6 text-center space-y-4 animate-rise-in border-amber-200 bg-amber-50/70">
            <span className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
              <AlertCircle size={24} />
            </span>
            <div>
              <h2 className="font-display font-bold text-lg text-ink">Maximum Active Tokens Reached (3/3)</h2>
              <p className="text-xs text-ink-soft mt-1 leading-relaxed max-w-sm mx-auto">
                You currently have 3 active tokens. Please wait until one of your existing tokens is completed or cleared before booking another slot.
              </p>
            </div>
            <div className="flex gap-2.5 pt-2 max-w-xs mx-auto">
              <button className="btn-secondary flex-1 text-xs font-semibold" onClick={() => router.push("/farmer")}>
                My Active Tokens
              </button>
              <button className="btn-primary flex-1 text-xs font-semibold" onClick={() => router.push("/farmer/queue")}>
                Live Queue
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* STEP 1: SELECT DATE */}
            {step === 1 && (
              <div className="space-y-4 animate-rise-in">
                <div>
                  <h2 className="font-display font-bold text-xl text-ink">Select procurement date</h2>
                  <p className="text-sm text-ink-faint mt-0.5">
                    Choose an appointment date within the active procurement window.
                  </p>
                </div>


            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {validDates.map((d) => {
                const isSelected = date === d.date;
                return (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => {
                      setDate(d.date);
                      setStep(2);
                    }}
                    className={`panel p-3.5 text-left transition-all hover:border-brand-600/50 hover:-translate-y-0.5 relative ${
                      isSelected ? "border-brand-600 ring-2 ring-brand-600/30 bg-brand-50/20" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-ink-faint uppercase">{d.dayName}</span>
                      {d.isToday && (
                        <span className="text-[10px] bg-brand-100 text-brand-700 font-bold px-1.5 py-0.5 rounded">
                          Today
                        </span>
                      )}
                    </div>
                    <p className="font-display font-extrabold text-2xl text-ink my-1 tnum">
                      {d.dayNumber}{" "}
                      <span className="text-xs font-medium text-ink-faint uppercase">{d.monthName}</span>
                    </p>
                    <p className="text-[11px] text-brand-600 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
                      {d.status}
                    </p>
                  </button>
                );
              })}
            </div>

            {validDates.length === 0 && !loading && (
              <div className="panel p-6 text-center text-ink-faint text-sm">
                No procurement centres are available for this date.
              </div>
            )}
          </div>
        )}

        {/* STEP 2: SELECT CROP */}
        {step === 2 && (
          <div className="space-y-4 animate-rise-in">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs text-brand-600 font-semibold bg-brand-50 px-2.5 py-1 rounded-full mb-1.5">
                <Calendar size={13} /> {formatDate(date)}
              </div>
              <h2 className="font-display font-bold text-xl text-ink">What crop are you procuring?</h2>
              <p className="text-sm text-ink-faint mt-0.5">Select the grain or crop you want to sell.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {crops.map((c) => {
                const isSelected = cropCode === c.code;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCropCode(c.code);
                      setStep(3);
                    }}
                    className={`panel p-4 text-left transition-all hover:border-brand-600/50 hover:-translate-y-0.5 ${
                      isSelected ? "border-brand-600 ring-2 ring-brand-600/30 bg-brand-50/20" : ""
                    }`}
                  >
                    <Wheat className="text-brand-600 mb-2" size={24} />
                    <p className="font-bold text-base text-ink">{c.name}</p>
                    <p className="text-xs text-ink-faint mt-0.5 font-medium">Code: {c.code}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3: SELECT PROCUREMENT CENTRE */}
        {step === 3 && (
          <div className="space-y-4 animate-rise-in">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-xs text-ink-faint">
                <span className="font-semibold text-brand-700">{formatDate(date)}</span> ·{" "}
                <span className="font-semibold text-ink">{selectedCrop?.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-xl text-ink">Choose procurement centre</h2>
                <div className="flex gap-1 text-[11px]">
                  <button
                    onClick={() => setSortBy("queue")}
                    className={`px-2 py-0.5 rounded-full border transition-colors ${
                      sortBy === "queue" ? "border-brand-600 text-brand-700 bg-brand-50 font-semibold" : "border-line text-ink-faint"
                    }`}
                  >
                    Shortest queue
                  </button>
                  <button
                    onClick={() => setSortBy("wait")}
                    className={`px-2 py-0.5 rounded-full border transition-colors ${
                      sortBy === "wait" ? "border-brand-600 text-brand-700 bg-brand-50 font-semibold" : "border-line text-ink-faint"
                    }`}
                  >
                    Fastest wait
                  </button>
                </div>
              </div>
            </div>

            {/* Recommended Centre Card */}
            {recommended && (
              <div className="panel p-4 border-grain/40 bg-grain-soft/30 space-y-2.5">
                <div className="flex items-center justify-end">
                  <span className="text-xs font-semibold text-ink-faint flex items-center gap-1">
                    <MapPin size={12} /> {recommended.distanceKm} km away
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-display font-bold text-lg text-ink">{recommended.name}</p>
                    <span className="text-[10px] font-mono font-bold bg-brand-100 text-brand-800 px-1.5 py-0.5 rounded">
                      {recommended.code}
                    </span>
                  </div>
                  <p className="text-xs text-ink-faint mt-0.5">{recommended.reason}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs py-1 border-y border-line/60">
                  <div>
                    <span className="text-ink-faint">Available capacity: </span>
                    <strong className="text-ink tnum">{recommended.availableCapacity}</strong>
                  </div>
                  <div>
                    <span className="text-ink-faint">Currently waiting: </span>
                    <strong className="text-ink tnum">{recommended.waiting}</strong>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="text-xs">
                    <LoadIndicator load={recommended.load === "LOW_LOAD" ? "NORMAL" : recommended.load} waiting={recommended.waiting} />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCentreId(recommended.id);
                      setStep(4);
                    }}
                    className="btn-primary !py-2 !px-4 text-xs font-semibold"
                  >
                    Select Centre ({recommended.code})
                  </button>
                </div>
              </div>
            )}

            {/* Centre List */}
            <div className="space-y-3">
              {sortedCentres.map((c) => {
                const isSelected = centreId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCentreId(c.id);
                      setStep(4);
                    }}
                    className={`panel w-full text-left p-4 transition-all hover:border-brand-600/50 ${
                      isSelected ? "border-brand-600 ring-2 ring-brand-600/30 bg-brand-50/20" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-base text-ink">{c.name}</p>
                          <span className="text-[10px] font-mono font-bold bg-surface-sunken text-ink-soft px-1.5 py-0.5 rounded border border-line">
                            {c.code}
                          </span>
                        </div>
                        <p className="text-xs text-ink-faint flex items-center gap-1.5 mt-0.5">
                          <MapPin size={12} className="text-brand-600" /> {c.distanceKm} km away · {c.district}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded">
                          {c.load.replace("_", " ")}
                        </span>
                      </div>
                    </div>


                    <div className="grid grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-line text-xs">
                      <div>
                        <p className="text-ink-faint">Capacity</p>
                        <p className="font-semibold text-ink tnum mt-0.5">{c.availableCapacity} slots</p>
                      </div>
                      <div>
                        <p className="text-ink-faint">Waiting</p>
                        <p className="font-semibold text-ink tnum mt-0.5">{c.waiting} farmers</p>
                      </div>
                      <div>
                        <p className="text-ink-faint">Est. Wait</p>
                        <p className="font-semibold text-ink tnum mt-0.5 flex items-center gap-1">
                          <Clock3 size={11} /> {c.estimatedWaitMins} min
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 4: SELECT AVAILABLE TIME SLOT */}
        {step === 4 && (
          <div className="space-y-4 animate-rise-in">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-ink-faint mb-1">
                <span>{formatDate(date)}</span> · <span>{selectedCentre?.name}</span>
              </div>
              <h2 className="font-display font-bold text-xl text-ink">Select available time slot</h2>
              <p className="text-sm text-ink-faint mt-0.5">
                Choose a time window for your crop delivery.
              </p>
            </div>

            {loadingSlots && <p className="text-sm text-ink-faint">Loading real-time slot availability...</p>}

            <div className="space-y-2.5">
              {slots.map((s) => {
                const isSelected = slotId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={s.isFull}
                    onClick={() => {
                      setSlotId(s.id);
                      setStep(5);
                    }}
                    className={`panel w-full p-4 flex items-center justify-between transition-all hover:border-brand-600/50 disabled:opacity-40 disabled:hover:border-line ${
                      isSelected ? "border-brand-600 ring-2 ring-brand-600/30 bg-brand-50/20" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Clock3 size={18} className={s.isFull ? "text-ink-faint" : "text-brand-600"} />
                      <span className="font-bold text-base text-ink tnum">
                        {s.startTime} – {s.endTime}
                      </span>
                    </div>
                    <div className="text-right">
                      {s.isFull ? (
                        <span className="text-xs font-bold text-error bg-error/10 px-2 py-0.5 rounded">FULL</span>
                      ) : (
                        <span className="text-xs font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded tnum">
                          {s.remaining} slots left
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}

              {slots.length === 0 && !loadingSlots && (
                <div className="panel p-6 text-center text-ink-faint text-sm">
                  All slots are currently full for this date.
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 5: ENTER QUANTITY */}
        {step === 5 && (
          <div className="panel p-5 space-y-4 animate-rise-in">
            <div>
              <h2 className="font-display font-bold text-xl text-ink">
                How much {selectedCrop?.name.toLowerCase()}?
              </h2>
              <p className="text-sm text-ink-faint mt-0.5">
                Enter your estimated crop delivery quantity in Quintals.
              </p>
            </div>

            <div>
              <label className="label">Quantity (Quintal)</label>
              <div className="relative">
                <input
                  className="input text-xl font-bold tnum pr-16"
                  type="number"
                  min={1}
                  max={2000}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="e.g. 45"
                  autoFocus
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-faint">
                  Quintal
                </span>
              </div>
              <p className="text-xs text-ink-faint mt-1.5">
                Minimum 1 Quintal · Maximum 2,000 Quintal per slot
              </p>
            </div>

            <button
              type="button"
              className="btn-primary w-full"
              disabled={!quantity || Number(quantity) <= 0 || Number(quantity) > 2000}
              onClick={() => setStep(6)}
            >
              Continue to Review
            </button>
          </div>
        )}

        {/* STEP 6: REVIEW & CONFIRM */}
        {step === 6 && (
          <div className="panel p-5 space-y-5 animate-rise-in">
            <div>
              <h2 className="font-display font-bold text-xl text-ink">Review booking</h2>
              <p className="text-sm text-ink-faint mt-0.5">
                Verify your appointment details before confirming.
              </p>
            </div>

            <div className="divide-y divide-line">
              <ReviewRow label="Procurement Date" value={formatDate(date)} />
              <ReviewRow label="Selected Crop" value={selectedCrop?.name || ""} />
              <ReviewRow label="Procurement Centre" value={selectedCentre?.name || ""} />
              <ReviewRow
                label="Time Slot"
                value={selectedSlot ? `${selectedSlot.startTime} – ${selectedSlot.endTime}` : ""}
              />
              <ReviewRow label="Estimated Quantity" value={`${quantity} Quintal`} emphasize />
              <ReviewRow
                label="Current Waiting Queue"
                value={`${selectedCentre?.waiting ?? 0} farmers waiting`}
              />
              <ReviewRow
                label="Estimated Wait Time"
                value={`~${selectedCentre?.estimatedWaitMins ?? 0} minutes`}
              />
            </div>

            <div className="bg-brand-50 border border-brand-600/15 rounded-lg p-3 text-xs text-brand-700 leading-relaxed">
              Upon confirmation, a digital queue token will be assigned to you in the live procurement system.
            </div>

            <button
              type="button"
              className="btn-primary w-full text-base font-bold !py-3.5"
              onClick={confirmBooking}
              disabled={submitting}
            >
              {submitting ? "Confirming Booking..." : "Confirm Booking"}
            </button>
          </div>
        )}
        </>
        )}
      </div>
      <FarmerNav />
    </main>
  );
}


function ReviewRow({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2.5 text-sm">
      <span className="text-ink-faint">{label}</span>
      <span className={`text-right ${emphasize ? "font-bold text-brand-700 text-base" : "font-semibold text-ink"}`}>
        {value}
      </span>
    </div>
  );
}
